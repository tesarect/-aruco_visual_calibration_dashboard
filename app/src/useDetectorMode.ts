import { useCallback, useState } from "react";
import * as ROSLIB from "roslib";

// calibration_orchestrator_node's ~/set_detector_mode
// (visual_calibration_msgs/srv/SetDetectorMode) — flips which of the two
// always-running detector nodes (aruco_perception's ArucoDetectorNode
// "classical", aruco_perception_yolo_bridge's YoloMarkerBridgeNode "hybrid")
// is actively publishing geometry_msgs/PoseStamped on
// /aruco_perception/marker_pose. Internally just toggles each node's own
// "active" bool parameter via the standard set_parameters service — no
// process start/stop, no warm-up wait. A plain service (not an action), so
// this is unaffected by rosbridge 1.3.1's lack of ROS2 action support (see
// useCalibrationAction.ts's header comment for that class of issue).
//
// Default state on the orchestrator node at startup is classical — this
// hook mirrors that as its own local initial state, same "local state until
// toggled" convention useCalibrationAction.ts uses for auto_center_enabled.
// There is no "get current detector mode" service today, so this hook can't
// read back the node's actual state on connect/reconnect — state here is
// tracked optimistically, exactly like auto_center_enabled.
const SET_DETECTOR_MODE_SERVICE = "/calibration_orchestrator_node/set_detector_mode";
const SET_DETECTOR_MODE_TYPE = "visual_calibration_msgs/srv/SetDetectorMode";

const MODE_CLASSICAL = "classical";
const MODE_HYBRID = "hybrid";

interface SetDetectorModeResponse {
  success: boolean;
  message: string;
}

export function useDetectorMode(ros: ROSLIB.Ros | null) {
  const [hybridEnabled, setHybridEnabledLocal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setHybridEnabled = useCallback(
    (enabled: boolean) => {
      console.log("[detectorMode] setHybridEnabled called", { enabled, hasRos: !!ros });
      if (!ros) {
        console.warn("[detectorMode] setHybridEnabled aborted: ros is null");
        return;
      }

      const mode = enabled ? MODE_HYBRID : MODE_CLASSICAL;
      setPending(true);
      setError(null);

      const service = new ROSLIB.Service({
        ros,
        name: SET_DETECTOR_MODE_SERVICE,
        serviceType: SET_DETECTOR_MODE_TYPE,
      });

      console.log("[detectorMode] calling", SET_DETECTOR_MODE_SERVICE, { mode });
      service.callService(
        { mode },
        (response: SetDetectorModeResponse) => {
          console.log("[detectorMode] set_detector_mode response", response);
          setPending(false);
          if (response.success) {
            setHybridEnabledLocal(enabled);
            setError(null);
          } else {
            // Leave hybridEnabled as-is (switch didn't actually take
            // effect) and surface the node's own explanation, e.g. the
            // hybrid inference server not being up yet.
            setError(response.message || "Failed to switch detector mode.");
          }
        },
        (error: unknown) => {
          console.error("[detectorMode] set_detector_mode service call failed", error);
          setPending(false);
          setError(String(error));
        }
      );
    },
    [ros]
  );

  return { hybridEnabled, setHybridEnabled, pending, error };
}