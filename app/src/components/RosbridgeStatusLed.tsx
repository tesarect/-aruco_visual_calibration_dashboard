import { cn } from "@/lib/utils";
import type { RosConnectionStatus } from "@/useRosbridge";

interface RosbridgeStatusLedProps {
  status: RosConnectionStatus;
}

const LED_STYLES: Record<RosConnectionStatus, { dot: string; glow: string; label: string }> = {
  connected: {
    dot: "bg-green-500",
    glow: "shadow-[0_0_8px_2px_rgba(34,197,94,0.7)]",
    label: "rosbridge connected",
  },
  connecting: {
    dot: "bg-yellow-500",
    glow: "shadow-[0_0_8px_2px_rgba(234,179,8,0.7)]",
    label: "rosbridge connecting...",
  },
  idle: {
    dot: "bg-red-500",
    glow: "shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]",
    label: "rosbridge disconnected",
  },
  error: {
    dot: "bg-red-500",
    glow: "shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]",
    label: "rosbridge connection error",
  },
};

export function RosbridgeStatusLed({ status }: RosbridgeStatusLedProps) {
  const { dot, glow, label } = LED_STYLES[status];

  return (
    <div className="flex items-center gap-2" title={label}>
      <span className={cn("h-2.5 w-2.5 rounded-full", dot, glow)} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}