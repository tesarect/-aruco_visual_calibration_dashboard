import { useCallback, useRef, useState } from "react";
import * as ROSLIB from "roslib";

// Real interface confirmed in visual_calibration_msgs/action/AutoCalibrate.action
// (calibration_orchestrator_node's ~/auto_calibrate) — see todo.txt THREAD A,
// 2026-07-18 "New ~/auto_calibrate entry point" note. This SUPERSEDES calling
// calibration_broadcaster_node's ~/calibrate directly: auto_calibrate chains
// the Cal Ready move, a camera-settle wait, an optional auto-center step, and
// the existing ~/calibrate call into one action, for both sim and real.
//
// NOT called directly as a ROS2 action from here — rosbridge_suite 1.3.1
// (this project's installed version) has NO action protocol support at all,
// confirmed 2026-07-20: neither roslib 1.4.1's ActionClient/Goal (legacy
// ROS1-actionlib-style topics — rosbridge rejects with "Unable to import
// msg class AutoCalibrateGoal from package visual_calibration_msgs", since
// ROS2's rosidl action codegen never produces flat *Goal/*Feedback/*Result
// classes) nor roslib 2.1.0's newer Action class (uses the real
// send_action_goal protocol op — rosbridge rejects THAT too: "Unknown
// operation: send_action_goal. Allowed operations: ['call_service',
// 'advertise', 'unadvertise', 'publish', 'subscribe', 'unsubscribe',
// 'fragment', 'advertise_service', 'service_response',
// 'unadvertise_service']") work against this rosbridge version. See
// resources/docs/info_stat.md's "Web/rosbridge gotchas" section.
//
// Instead uses calibration_orchestrator_node's rosbridge-reachable facade:
// ~/start_auto_calibrate (std_srvs/Trigger) to begin — submits the SAME
// AutoCalibrate goal server-side (the node is its own action client) and
// returns immediately once accepted, NOT once the sequence completes — and
// ~/auto_calibrate_status (a plain topic, AutoCalibrateStatus.msg) to watch
// progress/result, since call_service and subscribe are both operations
// rosbridge 1.3.1 already supports fine. ~/cancel_auto_calibrate
// (std_srvs/Trigger) is the matching cancel-side call. The underlying
// ~/auto_calibrate action itself — and everything IT calls, unchanged:
// Stage 4 still calls calibration_broadcaster_node's own ~/calibrate action
// exactly as before (move to vertex, wait for a fresh marker_pose to
// confirm a sample was captured there, next vertex) — is unaffected by any
// of this; only the outer "how does the browser trigger/watch the overall
// sequence" transport changed. Still directly usable by any ROS2-native
// client too (e.g. `ros2 action send_goal`, the startautocalibration shell
// alias).
const START_SERVICE = "/calibration_orchestrator_node/start_auto_calibrate";
const CANCEL_SERVICE = "/calibration_orchestrator_node/cancel_auto_calibrate";
const TRIGGER_TYPE = "std_srvs/srv/Trigger";
const STATUS_TOPIC = "/calibration_orchestrator_node/auto_calibrate_status";
const STATUS_TYPE = "visual_calibration_msgs/msg/AutoCalibrateStatus";

// Mirrors AutoCalibrateStatus.msg's phase enum.
const PHASE_RUNNING = 0;
const PHASE_SUCCEEDED = 1;

// calibration_orchestrator_node exposes a real, live-effect boolean parameter
// auto_center_enabled (defaults: sim=false, real=true) — unlike the old
// planning_mode workaround this one is actually read at runtime (todo.txt
// confirms it, "a simple switch in the UI, no new message type needed"). Set
// via the standard rcl_interfaces/srv/SetParameters service, same mechanism
// as before, just against the orchestrator node and with a bool parameter.
const SET_PARAMETERS_SERVICE = "/calibration_orchestrator_node/set_parameters";
const SET_PARAMETERS_TYPE = "rcl_interfaces/srv/SetParameters";
const PARAMETER_BOOL = 1;

// planning_mode is no longer a per-request UI choice — path-tuner's
// 2026-07-20 OMPL fixes (RRTstarkConfigDefault @ 3.0s x 8 attempts, tuned
// server-side in {sim,real}_ur3e_moveit_config + trajectory_planner_*.yaml)
// made planning strategy a tuned backend default, confirmed smooth/untangled
// on the real robot. The old cartesian/joint_space RadioGroup in
// CalibrationPanel had no live backend hook anyway (Calibrate.action/
// AutoCalibrate.action never had a per-call planning_mode goal field, todo.txt
// A3 still not done) — removed as obsolete rather than left as dead UI state.
export type CalibrationStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";

interface CalibrationFeedback {
  stage: string;
  samples_collected: number;
  samples_total: number;
}

interface CalibrationResult {
  success: boolean;
  message: string;
  max_spread_deg: number;
  mean_spread_deg: number;
  failed_stage: string;
}

// Wire shape of AutoCalibrateStatus.msg — one message per feedback/result
// event, distinguished by `phase` (feedback fields meaningful only while
// phase === PHASE_RUNNING; result fields meaningful only once phase is
// PHASE_SUCCEEDED/PHASE_FAILED — see the .msg file's own comment).
interface AutoCalibrateStatusMsg {
  phase: number;
  stage: string;
  samples_collected: number;
  samples_total: number;
  success: boolean;
  message: string;
  max_spread_deg: number;
  mean_spread_deg: number;
  failed_stage: string;
}

export function useCalibrationAction(ros: ROSLIB.Ros | null) {
  const [status, setStatus] = useState<CalibrationStatus>("idle");
  const [feedback, setFeedback] = useState<CalibrationFeedback | null>(null);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  // Defaults to off — matches calibration_orchestrator_node's sim default
  // (real defaults to true node-side, but the UI itself always starts
  // unset/off until the user flips it, same "local state until toggled"
  // convention as the rest of this file).
  const [autoCenterEnabled, setAutoCenterEnabledLocal] = useState(false);
  const [autoCenterError, setAutoCenterError] = useState<string | null>(null);
  // Holds the live ~/auto_calibrate_status subscription (started fresh by
  // every start() call) so stop()/a later start() can unsubscribe it —
  // otherwise a stale subscription from a previous run would keep
  // delivering messages (including a terminal phase) into this run's
  // state after the user already stopped/restarted.
  const statusTopicRef = useRef<ROSLIB.Topic<AutoCalibrateStatusMsg> | null>(null);

  const setAutoCenterEnabled = useCallback(
    (enabled: boolean) => {
      console.log("[calibration] setAutoCenterEnabled called", { enabled, hasRos: !!ros });
      setAutoCenterEnabledLocal(enabled);
      if (!ros) {
        console.warn("[calibration] setAutoCenterEnabled aborted: ros is null");
        return;
      }

      const service = new ROSLIB.Service({
        ros,
        name: SET_PARAMETERS_SERVICE,
        serviceType: SET_PARAMETERS_TYPE,
      });

      const request = {
        parameters: [
          {
            name: "auto_center_enabled",
            value: { type: PARAMETER_BOOL, bool_value: enabled },
          },
        ],
      };

      console.log("[calibration] calling /set_parameters", request);
      service.callService(
        request,
        (response: { results: { successful: boolean; reason: string }[] }) => {
          console.log("[calibration] /set_parameters response", response);
          const result = response.results?.[0];
          setAutoCenterError(result && !result.successful ? result.reason : null);
        },
        (error: unknown) => {
          console.error("[calibration] /set_parameters service call failed", error);
          setAutoCenterError(String(error));
        }
      );
    },
    [ros]
  );

  const start = useCallback(() => {
    console.log("[calibration] start() called", { hasRos: !!ros });
    if (!ros) {
      console.warn("[calibration] start aborted: ros is null");
      return;
    }

    setStatus("running");
    setFeedback(null);
    setResult(null);

    // Unsubscribe any leftover subscription from a previous run before
    // starting a new one — see statusTopicRef's doc comment.
    statusTopicRef.current?.unsubscribe();

    const statusTopic = new ROSLIB.Topic<AutoCalibrateStatusMsg>({
      ros,
      name: STATUS_TOPIC,
      messageType: STATUS_TYPE,
    });
    statusTopicRef.current = statusTopic;

    statusTopic.subscribe((msg: AutoCalibrateStatusMsg) => {
      console.log("[calibration] auto_calibrate_status", msg);
      if (msg.phase === PHASE_RUNNING) {
        setFeedback({
          stage: msg.stage,
          samples_collected: msg.samples_collected,
          samples_total: msg.samples_total,
        });
        return;
      }

      // Terminal message (PHASE_SUCCEEDED or PHASE_FAILED) — this run is
      // done, stop listening so a later run's messages don't get missed
      // due to an unclean handoff between subscriptions.
      setResult({
        success: msg.success,
        message: msg.message,
        max_spread_deg: msg.max_spread_deg,
        mean_spread_deg: msg.mean_spread_deg,
        failed_stage: msg.failed_stage,
      });
      setStatus(msg.phase === PHASE_SUCCEEDED ? "succeeded" : "failed");
      statusTopic.unsubscribe();
      statusTopicRef.current = null;
    });

    const startService = new ROSLIB.Service({
      ros,
      name: START_SERVICE,
      serviceType: TRIGGER_TYPE,
    });

    console.log("[calibration] calling", START_SERVICE);
    startService.callService(
      {},
      (response: { success: boolean; message: string }) => {
        console.log(`[calibration] ${START_SERVICE} response`, response);
        if (!response.success) {
          setStatus("failed");
          statusTopic.unsubscribe();
          statusTopicRef.current = null;
        }
        // On success, leave status as "running" — the subscription above
        // drives all further state transitions from here.
      },
      (error: unknown) => {
        console.error(`[calibration] ${START_SERVICE} service call failed`, error);
        setStatus("failed");
        statusTopic.unsubscribe();
        statusTopicRef.current = null;
      }
    );
  }, [ros]);

  const stop = useCallback(() => {
    console.log("[calibration] stop() called", { hasRos: !!ros });
    statusTopicRef.current?.unsubscribe();
    statusTopicRef.current = null;
    setStatus("cancelled");

    if (!ros) {
      console.warn("[calibration] stop: ros is null, cannot send cancel request");
      return;
    }

    const cancelService = new ROSLIB.Service({
      ros,
      name: CANCEL_SERVICE,
      serviceType: TRIGGER_TYPE,
    });

    console.log("[calibration] calling", CANCEL_SERVICE);
    cancelService.callService(
      {},
      (response: { success: boolean; message: string }) => {
        console.log("[calibration] cancel_auto_calibrate response", response);
      },
      (error: unknown) => {
        console.error("[calibration] cancel_auto_calibrate service call failed", error);
      }
    );
  }, [ros]);

  return {
    status,
    feedback,
    result,
    start,
    stop,
    autoCenterEnabled,
    setAutoCenterEnabled,
    autoCenterError,
  };
}
