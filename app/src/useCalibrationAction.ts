import { useCallback, useRef, useState } from "react";
import ROSLIB from "roslib";

// Real interface confirmed in visual_calibration_msgs/action/Calibrate.action
// (calibration_broadcaster_node's ~/calibrate) — see roswebdev.md. Goal is
// empty; feedback carries live sample progress; result carries the final
// spread stats. Cancellable via ROSLIB.Goal's native cancel(), matching
// standard rclpy_action goal/cancel handling — no separate "stop" service
// needed.
const ACTION_NAME = "/calibration_broadcaster_node/calibrate";
const ACTION_TYPE = "visual_calibration_msgs/action/Calibrate";

export type CalibrationStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

interface CalibrationFeedback {
  samples_collected: number;
  samples_total: number;
}

interface CalibrationResult {
  success: boolean;
  message: string;
  max_spread_deg: number;
  mean_spread_deg: number;
}

export function useCalibrationAction(ros: ROSLIB.Ros | null) {
  const [status, setStatus] = useState<CalibrationStatus>("idle");
  const [feedback, setFeedback] = useState<CalibrationFeedback | null>(null);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const goalRef = useRef<ROSLIB.Goal | null>(null);

  const start = useCallback(() => {
    if (!ros) return;

    setStatus("running");
    setFeedback(null);
    setResult(null);

    const actionClient = new ROSLIB.ActionClient({
      ros,
      serverName: ACTION_NAME,
      actionName: ACTION_TYPE,
    });

    const goal = new ROSLIB.Goal({
      actionClient,
      goalMessage: {},
    });
    goalRef.current = goal;

    goal.on("feedback", (fb: CalibrationFeedback) => setFeedback(fb));
    goal.on("result", (res: CalibrationResult) => {
      setResult(res);
      setStatus(res.success ? "succeeded" : "failed");
    });

    goal.send();
  }, [ros]);

  const stop = useCallback(() => {
    goalRef.current?.cancel();
    setStatus("cancelled");
  }, []);

  return { status, feedback, result, start, stop };
}