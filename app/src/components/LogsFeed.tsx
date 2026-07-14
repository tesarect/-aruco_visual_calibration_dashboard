import type { CSSProperties } from "react";
import type { LogLine } from "@/useRosout";

interface LogsFeedProps {
  lines: LogLine[];
}

const BRIGHT_COUNT = 5;
const FADED_COUNT = 5;

// White -> gray endpoints for the middle band's gradient, matched to the
// bright/faded tailwind colors below (slate-100 / slate-400) so the
// transition reads as continuous rather than jumping between bands.
const BRIGHT_RGB = [241, 245, 249]; // slate-100
const FADED_RGB = [148, 163, 184]; // slate-400

function interpolatedColor(t: number) {
  const [r1, g1, b1] = BRIGHT_RGB;
  const [r2, g2, b2] = FADED_RGB;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// Newest-first render order so new lines slide in at the top and the oldest
// (index 19, the 20th line) is the next to drop off as useRosout's ring
// buffer fills. First 5 (most recent) stay full-bright, last 5 (oldest) are
// greyed out at 60% opacity, and everything in between gradient-fades from
// white to gray across the middle band.
export function LogsFeed({ lines }: LogsFeedProps) {
  const newestFirst = [...lines].reverse();
  const middleCount = Math.max(newestFirst.length - BRIGHT_COUNT - FADED_COUNT, 0);

  return (
    <div className="flex w-full flex-col-reverse gap-0.5 font-mono text-[12px] leading-tight">
      {newestFirst.map((line, index) => {
        let style: CSSProperties | undefined;
        let className = "";

        if (index < BRIGHT_COUNT) {
          className = "text-slate-100";
        } else if (index >= BRIGHT_COUNT + middleCount) {
          className = "text-slate-400/60";
        } else {
          const t = (index - BRIGHT_COUNT + 1) / (middleCount + 1);
          style = { color: interpolatedColor(t) };
        }

        return (
          <p key={line.id} className={`truncate ${className}`} style={style}>
            <span className="text-slate-400/80">[{line.nodeName}]</span> {line.message}
          </p>
        );
      })}
    </div>
  );
}