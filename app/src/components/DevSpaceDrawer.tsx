import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import type { useCalibrationAction } from "@/useCalibrationAction";

interface DevSpaceDrawerProps {
  calibration: ReturnType<typeof useCalibrationAction>;
  trailEnabled: boolean;
  onTrailEnabledChange: (enabled: boolean) => void;
}

// A4 (todo.txt): dev space bottom drawer for dev-related observations/logs —
// deferred earlier in the project, now built. Bottom drawer (not left, like
// Control/Visual Markers) since its content is 3 independent side-by-side
// columns rather than a single scrollable list, and doesn't gate a live TF
// subscription the way ControlPanel's drawer does.
//
// 3 equal columns, vertical Separators between them (left: calibration
// spread-result text, moved out of CalibrationPanel per explicit request;
// center: the gripper-trail toggle; right: reserved for a spread-value graph,
// deliberately left empty — graph choice explicitly deferred to a follow-up).
export function DevSpaceDrawer({ calibration, trailEnabled, onTrailEnabledChange }: DevSpaceDrawerProps) {
  const { status, result } = calibration;

  return (
    <Drawer direction="bottom">
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full">
          Dev Space
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Dev Space</DrawerTitle>
        </DrawerHeader>
        <div className="flex h-64 items-stretch">
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Calibration result
            </span>
            {status === "succeeded" && result && (
              <p className="text-sm text-green-600">
                Done — max spread {result.max_spread_deg.toFixed(1)}°, mean{" "}
                {result.mean_spread_deg.toFixed(1)}°
              </p>
            )}
            {status === "failed" && result && (
              <p className="text-sm text-destructive">
                {result.failed_stage
                  ? `Failed at stage: ${result.failed_stage} — ${result.message}`
                  : `Failed: ${result.message}`}
              </p>
            )}
            {status === "cancelled" && (
              <p className="text-sm text-muted-foreground">Cancelled.</p>
            )}
            {status !== "succeeded" && status !== "failed" && status !== "cancelled" && (
              <p className="text-sm text-muted-foreground">No calibration result yet.</p>
            )}
          </div>

          <Separator orientation="vertical" />

          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
            <Label htmlFor="gripper-trail-switch" className="text-sm text-muted-foreground">
              Gripper trail
            </Label>
            <Switch
              id="gripper-trail-switch"
              checked={trailEnabled}
              onCheckedChange={onTrailEnabledChange}
            />
          </div>

          <Separator orientation="vertical" />

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Spread graph
            </span>
            <p className="text-sm text-muted-foreground">Coming soon.</p>
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
