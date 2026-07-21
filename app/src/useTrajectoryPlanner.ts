import { useCallback, useState } from "react";
import * as ROSLIB from "roslib";

// trajectory_planner is constructed with the literal node name
// "trajectory_planner" (visual_calibration_moveit/src/trajectory_planner/main.cpp),
// so its private ("~/...") services resolve to /trajectory_planner/....
const NODE_NAME = "/trajectory_planner";
const GET_STANDOFF_POSE_SERVICE = `${NODE_NAME}/get_standoff_pose`;
const GET_STANDOFF_POSE_TYPE = "visual_calibration_msgs/srv/GetStandoffPose";
const GET_PRESET_POSE_SERVICE = `${NODE_NAME}/get_preset_pose`;
const GET_PRESET_POSE_TYPE = "visual_calibration_msgs/srv/GetPresetPose";
const TRACE_PATH_SERVICE = `${NODE_NAME}/trace_path`;
const TRACE_PATH_TYPE = "visual_calibration_msgs/srv/TracePath";
const MOVE_TO_PRESET_SERVICE = `${NODE_NAME}/move_to_preset`;
const MOVE_TO_PRESET_TYPE = "visual_calibration_msgs/srv/MoveToPreset";

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

interface GetPresetPoseResponse {
  success: boolean;
  message: string;
  pose: Pose;
}

interface TracePathResponse {
  success: boolean;
  message: string;
}

interface MoveToPresetResponse {
  success: boolean;
  message: string;
}

export type MoveToStandoffStatus = "idle" | "moving" | "succeeded" | "failed";

function traceToPose(
  ros: ROSLIB.Ros,
  poseName: string,
  pose: Pose,
  setStatus: (status: MoveToStandoffStatus) => void,
  setMessage: (message: string | null) => void
) {
  const tracePath = new ROSLIB.Service({
    ros,
    name: TRACE_PATH_SERVICE,
    serviceType: TRACE_PATH_TYPE,
  });

  const request = {
    waypoints: [pose],
    planning_mode: PLANNING_MODE_JOINT_SPACE,
    // pose_name only means something for a single-waypoint call (true
    // here) — trajectory_planner publishes it verbatim on
    // ~/current_pose_name once the move succeeds, and uses it as the
    // ~/planning_failure `context` if it fails instead.
    pose_name: poseName,
  };

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
}

/**
 * "Cal Ready" and named-preset moves (e.g. "standby") both chain two calls,
 * per trajectory_planner's own documented flow (main.cpp): the get_*_pose
 * services are read-only (just return a Pose, never move the arm), so
 * actually moving requires passing that pose to ~/trace_path separately.
 * Joint-space planning is used for these "return_to"-style moves
 * specifically, since real-world layout/obstacles aren't as fully known as
 * sim's — Cartesian remains the default for the calibration polygon itself,
 * untouched by this hook.
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

    const fallbackToStandoffPose = () => {
      const getStandoffPose = new ROSLIB.Service({
        ros,
        name: GET_STANDOFF_POSE_SERVICE,
        serviceType: GET_STANDOFF_POSE_TYPE,
      });

      console.log("[trajectory] calling", GET_STANDOFF_POSE_SERVICE);
      getStandoffPose.callService(
        {},
        (poseResponse: GetStandoffPoseResponse) => {
          console.log("[trajectory] get_standoff_pose response", poseResponse);
          if (!poseResponse.success) {
            setStatus("failed");
            setMessage(poseResponse.message || "Failed to resolve standoff pose");
            return;
          }

          traceToPose(ros, "cal_ready", poseResponse.standoff_pose, setStatus, setMessage);
        },
        (error: unknown) => {
          console.error("[trajectory] get_standoff_pose service call failed", error);
          setStatus("failed");
          setMessage(String(error));
        }
      );
    };

    const moveToPresetService = new ROSLIB.Service({
      ros,
      name: MOVE_TO_PRESET_SERVICE,
      serviceType: MOVE_TO_PRESET_TYPE,
    });

    console.log("[trajectory] calling", MOVE_TO_PRESET_SERVICE, { name: "cal_ready" });
    moveToPresetService.callService(
      { name: "cal_ready" },
      (response: MoveToPresetResponse) => {
        console.log("[trajectory] move_to_preset response", response);
        if (response.success) {
          setStatus("succeeded");
          setMessage(response.message || null);
          return;
        }

        if (response.message && response.message.includes("No preset named")) {
          console.log("[trajectory] no cal_ready preset configured, falling back to get_standoff_pose");
          fallbackToStandoffPose();
          return;
        }

        setStatus("failed");
        setMessage(response.message || "Failed to move to cal_ready preset");
      },
      (error: unknown) => {
        console.warn("[trajectory] move_to_preset service call failed, falling back to get_standoff_pose", error);
        fallbackToStandoffPose();
      }
    );
  }, [ros]);

  const moveToPreset = useCallback(
    (presetName: string) => {
      console.log("[trajectory] moveToPreset called", { presetName, hasRos: !!ros });
      if (!ros) {
        console.warn("[trajectory] moveToPreset aborted: ros is null");
        return;
      }

      setStatus("moving");
      setMessage(null);

      const getPresetPose = new ROSLIB.Service({
        ros,
        name: GET_PRESET_POSE_SERVICE,
        serviceType: GET_PRESET_POSE_TYPE,
      });

      const request = { name: presetName };

      console.log("[trajectory] calling", GET_PRESET_POSE_SERVICE, request);
      getPresetPose.callService(
        request,
        (poseResponse: GetPresetPoseResponse) => {
          console.log("[trajectory] get_preset_pose response", poseResponse);
          if (!poseResponse.success) {
            setStatus("failed");
            setMessage(poseResponse.message || `Failed to resolve preset "${presetName}"`);
            return;
          }

          traceToPose(ros, presetName, poseResponse.pose, setStatus, setMessage);
        },
        (error: unknown) => {
          console.error("[trajectory] get_preset_pose service call failed", error);
          setStatus("failed");
          setMessage(String(error));
        }
      );
    },
    [ros]
  );

  return { status, message, moveToStandoff, moveToPreset };
}