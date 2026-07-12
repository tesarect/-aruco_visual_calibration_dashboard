import type { LogLine } from "@/useRosout";

interface LogsFeedProps {
  lines: LogLine[];
}

// Newest-first render order so new lines slide in at the top and the oldest
// (index 7, the 8th line) is the next to drop off as useRosout's ring buffer
// fills — the last 2 (most recent) stay full-bright, everything older fades
// progressively, per the "dark background, light text" request.
export function LogsFeed({ lines }: LogsFeedProps) {
  const newestFirst = [...lines].reverse();

  return (
    <div className="flex w-96 flex-col-reverse gap-0.5 font-mono text-[12px] leading-tight">
      {newestFirst.map((line, index) => (
        <p
          key={line.id}
          className={
            index < 2
              ? "text-slate-100"
              : "text-slate-400/60"
          }
        >
          <span className="text-slate-400/80">[{line.nodeName}]</span> {line.message}
        </p>
      ))}
    </div>
  );
}