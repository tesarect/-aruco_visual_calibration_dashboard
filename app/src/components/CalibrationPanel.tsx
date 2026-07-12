import ROSLIB from "roslib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCalibrationAction } from "@/useCalibrationAction";

interface CalibrationPanelProps {
  ros: ROSLIB.Ros | null;
}

export function CalibrationPanel({ ros }: CalibrationPanelProps) {
  const { status, feedback, result, start, stop } = useCalibrationAction(ros);
  const running = status === "running";

  return (
    <Card className="w-64">
      <CardHeader>
        <CardTitle>Calibration</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button onClick={start} disabled={running || !ros} className="flex-1">
            Calibrate
          </Button>
          <Button onClick={stop} disabled={!running} variant="outline" className="flex-1">
            Stop
          </Button>
        </div>

        {running && feedback && (
          <p className="text-sm text-muted-foreground">
            Samples: {feedback.samples_collected} / {feedback.samples_total}
          </p>
        )}

        {status === "succeeded" && result && (
          <p className="text-sm text-green-600">
            Done — max spread {result.max_spread_deg.toFixed(1)}°, mean{" "}
            {result.mean_spread_deg.toFixed(1)}°
          </p>
        )}

        {status === "failed" && result && (
          <p className="text-sm text-destructive">Failed: {result.message}</p>
        )}

        {status === "cancelled" && <p className="text-sm text-muted-foreground">Cancelled.</p>}
      </CardContent>
    </Card>
  );
}