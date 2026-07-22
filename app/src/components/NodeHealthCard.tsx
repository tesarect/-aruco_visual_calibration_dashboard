import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { HealthState } from "@/useNodeHealth";

interface NodeHealthCardProps {
  robotStatePublisher: HealthState;
  trajectoryController: HealthState;
  checking: boolean;
  onRefresh: () => void;
}

// Same glowing-dot visual language as RosbridgeStatusLed, extended with a
// muted "unknown" state (nothing checked yet — distinct from a confirmed
// inactive result).
const LED_STYLES: Record<HealthState, { dot: string; glow: string }> = {
  unknown: { dot: "bg-muted-foreground/40", glow: "" },
  checking: { dot: "bg-yellow-500", glow: "shadow-[0_0_8px_2px_rgba(234,179,8,0.7)]" },
  active: { dot: "bg-green-500", glow: "shadow-[0_0_8px_2px_rgba(34,197,94,0.7)]" },
  inactive: { dot: "bg-red-500", glow: "shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]" },
};

function HealthRow({ label, state }: { label: string; state: HealthState }) {
  const { dot, glow } = LED_STYLES[state];
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("h-2 w-2 rounded-full", dot, glow)} title={state} />
    </div>
  );
}

export function NodeHealthCard({
  robotStatePublisher,
  trajectoryController,
  checking,
  onRefresh,
}: NodeHealthCardProps) {
  return (
    <Card className="w-56 bg-background/60 backdrop-blur-sm">
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">Node health</span>
          <Button variant="ghost" size="xs" onClick={onRefresh} disabled={checking}>
            {checking ? "Checking…" : "Refresh"}
          </Button>
        </div>
        <HealthRow label="robot_state_publisher" state={robotStatePublisher} />
        <HealthRow label="Trajectory controller" state={trajectoryController} />
      </CardContent>
    </Card>
  );
}
