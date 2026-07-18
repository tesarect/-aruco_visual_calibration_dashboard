import { useCallback, useState } from "react";
import ROSLIB from "roslib";
import type { Pose } from "@/useGripperPose";

const TRACE_PATH_SERVICE = "/trajectory_planner/trace_path";
const TRACE_PATH_TYPE = "visual_calibration_msgs/srv/TracePath";

// TracePath.srv: uint8 PLANNING_MODE_JOINT_SPACE=0, PLANNING_MODE_CARTESIAN=1
const PLANNING_MODE_CARTESIAN = 1;

// Each press is a single, small, straight-line move along exactly one axis —
// deliberately NOT cumulative/tracked against a running total (per explicit
// choice: simpler to reason about than an anchor-and-limit scheme, and the
// operator is watching the arm live while pressing). 0.02m ≈ 0.8in; tune
// once tried against the real arm.
export const NUDGE_STEP_METERS = 0.02;

export type Axis = "x" | "y" | "z";
export type NudgeStatus = "idle" | "moving" | "succeeded" | "failed";

interface TracePathResponse {
  success: boolean;
  message: string;
}

export function useNudgeControl(ros: ROSLIB.Ros | null) {
  const [status, setStatus] = useState<NudgeStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const nudge = useCallback(
    (currentPose: Pose, axis: Axis, direction: 1 | -1) => {
      console.log("[nudge] called", { axis, direction, currentPose });
      if (!ros) {
        console.warn("[nudge] aborted: ros is null");
        return;
      }

      const delta = NUDGE_STEP_METERS * direction;
      const targetPose = {
        position: {
          x: currentPose.position.x + (axis === "x" ? delta : 0),
          y: currentPose.position.y + (axis === "y" ? delta : 0),
          z: currentPose.position.z + (axis === "z" ? delta : 0),
        },
        orientation: currentPose.orientation,
      };

      setStatus("moving");
      setMessage(null);

      const tracePath = new ROSLIB.Service({
        ros,
        name: TRACE_PATH_SERVICE,
        serviceType: TRACE_PATH_TYPE,
      });

      const request = new ROSLIB.ServiceRequest({
        waypoints: [targetPose],
        // Cartesian, not joint-space — a nudge along one axis should move in
        // a straight line along that axis, not an arbitrary joint-space path
        // that happens to end at the same point.
        planning_mode: PLANNING_MODE_CARTESIAN,
        pose_name: `nudge_${axis}${direction > 0 ? "+" : "-"}`,
      });

      console.log("[nudge] calling", TRACE_PATH_SERVICE, request);
      tracePath.callService(
        request,
        (response: TracePathResponse) => {
          console.log("[nudge] trace_path response", response);
          setStatus(response.success ? "succeeded" : "failed");
          setMessage(response.message || null);
        },
        (error: unknown) => {
          console.error("[nudge] trace_path service call failed", error);
          setStatus("failed");
          setMessage(String(error));
        }
      );
    },
    [ros]
  );

  return { status, message, nudge };
}