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

// calibration_broadcaster_node.cpp reads "planning_mode" as a plain string
// param ("cartesian" | "joint_space", anything else throws) and uses it for
// its own ~/trace_path calls — Calibrate.action's goal has no field to carry
// this, so it's set as a live ROS2 parameter via the standard
// rcl_interfaces/srv/SetParameters service instead, before Calibrate is sent.
const SET_PARAMETERS_SERVICE = "/calibration_broadcaster_node/set_parameters";
const SET_PARAMETERS_TYPE = "rcl_interfaces/srv/SetParameters";
const PARAMETER_STRING = 4;

export type PlanningMode = "cartesian" | "joint_space";
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
  const [planningModeError, setPlanningModeError] = useState<string | null>(null);
  const goalRef = useRef<ROSLIB.Goal | null>(null);

  const setPlanningMode = useCallback(
    (mode: PlanningMode) => {
      if (!ros) return;

      const service = new ROSLIB.Service({
        ros,
        name: SET_PARAMETERS_SERVICE,
        serviceType: SET_PARAMETERS_TYPE,
      });

      const request = new ROSLIB.ServiceRequest({
        parameters: [
          {
            name: "planning_mode",
            value: { type: PARAMETER_STRING, string_value: mode },
          },
        ],
      });

      service.callService(request, (response: { results: { successful: boolean; reason: string }[] }) => {
        const result = response.results?.[0];
        setPlanningModeError(result && !result.successful ? result.reason : null);
      });
    },
    [ros]
  );

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

  return { status, feedback, result, start, stop, setPlanningMode, planningModeError };
}