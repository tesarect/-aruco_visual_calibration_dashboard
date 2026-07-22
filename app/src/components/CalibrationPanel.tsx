import * as ROSLIB from "roslib";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { useCalibrationAction } from "@/useCalibrationAction";
import { useDetectorMode } from "@/useDetectorMode";

interface CalibrationPanelProps {
  ros: ROSLIB.Ros | null;
  calibration: ReturnType<typeof useCalibrationAction>;
}

// Terminal-result display (succeeded/failed/cancelled — the spread-degree
// details) moved out of this panel into the Dev Space drawer's left column,
// per explicit request; calibration state itself is now lifted to App and
// passed down here (and to DevSpaceDrawer) as a prop, rather than each
// consumer calling useCalibrationAction independently and getting
// out-of-sync copies of the same run's state.
export function CalibrationPanel({ ros, calibration }: CalibrationPanelProps) {
  const {
    status,
    feedback,
    start,
    stop,
    autoCenterEnabled,
    setAutoCenterEnabled,
    autoCenterError,
  } = calibration;
  const {
    hybridEnabled,
    setHybridEnabled,
    pending: detectorModePending,
    error: detectorModeError,
  } = useDetectorMode(ros);
  const running = status === "running";

  console.log("[calibration] CalibrationPanel render", {
    hasRos: !!ros,
    status,
    running,
    calibrateDisabled: running || !ros,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 flex-1">
          <Button onClick={start} disabled={running || !ros} className="flex-1">
            Calibrate
          </Button>
          <Button onClick={stop} disabled={!running} variant="destructive">
            Cancel
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="auto-center-switch" className="text-sm text-muted-foreground">
            Auto-center
          </Label>
          <Switch
            id="auto-center-switch"
            checked={autoCenterEnabled}
            onCheckedChange={setAutoCenterEnabled}
          />
        </div>
      </div>

      {autoCenterError && <p className="text-sm text-destructive">{autoCenterError}</p>}

      <div className="flex items-center justify-between gap-2 mt-1 pt-3 border-t">
        <Label htmlFor="hybrid-detection-switch" className="text-sm text-muted-foreground">
          Hybrid ArUco Detection
        </Label>
        <Switch
          id="hybrid-detection-switch"
          checked={hybridEnabled}
          disabled={!ros || detectorModePending}
          onCheckedChange={setHybridEnabled}
        />
      </div>

      {detectorModeError && <p className="text-sm text-destructive">{detectorModeError}</p>}

      {running && feedback && (
        <div className="text-sm text-muted-foreground">
          <p>Stage: {feedback.stage}</p>
          {feedback.samples_total > 0 && (
            <p>
              Samples: {feedback.samples_collected} / {feedback.samples_total}
            </p>
          )}
        </div>
      )}
    </div>
  );
}