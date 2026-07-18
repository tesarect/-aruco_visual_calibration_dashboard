import { useCallback, useState } from "react";
import ROSLIB from "roslib";

// trajectory_planner is constructed with the literal node name
// "trajectory_planner" (visual_calibration_moveit/src/trajectory_planner/main.cpp),
// so its private ("~/...") services resolve to /trajectory_planner/....
const NODE_NAME = "/trajectory_planner";
const GET_STANDOFF_POSE_SERVICE = `${NODE_NAME}/get_standoff_pose`;
const GET_STANDOFF_POSE_TYPE = "visual_calibration_msgs/srv/GetStandoffPose";
const TRACE_PATH_SERVICE = `${NODE_NAME}/trace_path`;
const TRACE_PATH_TYPE = "visual_calibration_msgs/srv/TracePath";

// TracePath.srv: uint8 PLANNING_MODE_JOINT_SPACE=0, PLANNING_MODE_CARTESIAN=1
const PLANNING_MODE_JOINT_SPACE = 0;

interface Pose {
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
}

interface GetStandoffPoseResponse {
  success: boolean;
  used_fallback: boolean;
  message: string;
  standoff_pose: Pose;
}

interface TracePathResponse {
  success: boolean;
  message: string;
}

export type MoveToStandoffStatus = "idle" | "moving" | "succeeded" | "failed";

/**
 * "Cal Ready" chains two calls, per trajectory_planner's own documented
 * flow (main.cpp): ~/get_standoff_pose is read-only (just returns a Pose,
 * never moves the arm), so actually moving requires passing that pose to
 * ~/trace_path separately. Joint-space planning is used here specifically
 * per todo.txt's guidance for this "return_to"-style move, since real-world
 * layout/obstacles aren't as fully known as sim's — Cartesian remains the
 * default for the calibration polygon itself, untouched by this hook.
 */
export function useTrajectoryPlanner(ros: ROSLIB.Ros | null) {
  const [status, setStatus] = useState<MoveToStandoffStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const moveToStandoff = useCallback(() => {
    console.log("[trajectory] moveToStandoff called", { hasRos: !!ros });
    if (!ros) {
      console.warn("[trajectory] moveToStandoff aborted: ros is null");
      return;
    }

    setStatus("moving");
    setMessage(null);

    const getStandoffPose = new ROSLIB.Service({
      ros,
      name: GET_STANDOFF_POSE_SERVICE,
      serviceType: GET_STANDOFF_POSE_TYPE,
    });

    console.log("[trajectory] calling", GET_STANDOFF_POSE_SERVICE);
    getStandoffPose.callService(
      new ROSLIB.ServiceRequest({}),
      (poseResponse: GetStandoffPoseResponse) => {
        console.log("[trajectory] get_standoff_pose response", poseResponse);
        if (!poseResponse.success) {
          setStatus("failed");
          setMessage(poseResponse.message || "Failed to resolve standoff pose");
          return;
        }

        const tracePath = new ROSLIB.Service({
          ros,
          name: TRACE_PATH_SERVICE,
          serviceType: TRACE_PATH_TYPE,
        });

        const request = new ROSLIB.ServiceRequest({
          waypoints: [poseResponse.standoff_pose],
          planning_mode: PLANNING_MODE_JOINT_SPACE,
          // pose_name only means something for a single-waypoint call (true
          // here) — trajectory_planner publishes it verbatim on
          // ~/current_pose_name once the move succeeds, and uses it as the
          // ~/planning_failure `context` if it fails instead.
          pose_name: "cal_ready",
        });

        console.log("[trajectory] calling", TRACE_PATH_SERVICE, request);
        tracePath.callService(
          request,
          (traceResponse: TracePathResponse) => {
            console.log("[trajectory] trace_path response", traceResponse);
            setStatus(traceResponse.success ? "succeeded" : "failed");
            setMessage(traceResponse.message || null);
          },
          (error: unknown) => {
            console.error("[trajectory] trace_path service call failed", error);
            setStatus("failed");
            setMessage(String(error));
          }
        );
      },
      (error: unknown) => {
        console.error("[trajectory] get_standoff_pose service call failed", error);
        setStatus("failed");
        setMessage(String(error));
      }
    );
  }, [ros]);

  return { status, message, moveToStandoff };
}