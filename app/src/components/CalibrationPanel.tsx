import * as ROSLIB from "roslib";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCalibrationAction } from "@/useCalibrationAction";
import { useDetectorMode } from "@/useDetectorMode";

interface CalibrationPanelProps {
  ros: ROSLIB.Ros | null;
}

export function CalibrationPanel({ ros }: CalibrationPanelProps) {
  const {
    status,
    feedback,
    result,
    start,
    stop,
    autoCenterEnabled,
    setAutoCenterEnabled,
    autoCenterError,
  } = useCalibrationAction(ros);
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

      {status === "cancelled" && <p className="text-sm text-muted-foreground">Cancelled.</p>}
    </div>
  );
}