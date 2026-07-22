import { useCallback, useState } from "react";
import * as ROSLIB from "roslib";
import type { RobotEnv } from "@/markerFrames";

// CLAUDE.md: sim's ur3e_moveit_config wires joint_trajectory_controller;
// real's Thread B bring-up (todo.txt) uses scaled_joint_trajectory_controller
// instead — same role, different name per env.
const TRAJECTORY_CONTROLLER_NAME_BY_ENV: Record<RobotEnv, string> = {
  sim: "joint_trajectory_controller",
  real: "scaled_joint_trajectory_controller",
};

const ROBOT_DESCRIPTION_TOPIC = "/robot_description";
const LIST_CONTROLLERS_SERVICE = "/controller_manager/list_controllers";
const LIST_CONTROLLERS_TYPE = "controller_manager_msgs/srv/ListControllers";

export type HealthState = "unknown" | "checking" | "active" | "inactive";

export interface NodeHealth {
  robotStatePublisher: HealthState;
  trajectoryController: HealthState;
  checking: boolean;
  refresh: () => void;
}

interface ControllerState {
  name: string;
  state: string;
}

interface ListControllersResponse {
  controller: ControllerState[];
}

// On-demand only, per explicit project decision (no background polling) —
// robot_description is checked by taking one fresh subscription and reading
// whatever arrives within a short window (it's published transient_local by
// robot_state_publisher, so a fresh subscriber gets the latched last value
// immediately if the publisher is alive; nothing arriving in the window
// means either no publisher or a slow bridge, treated the same as inactive
// here since we can't distinguish further without polling). Controller
// state has no push equivalent in ROS2 at all — /controller_manager/
// list_controllers is a plain service call, the standard way to read
// ros2_control activation state, called fresh every refresh().
export function useNodeHealth(ros: ROSLIB.Ros | null, env: RobotEnv | null): NodeHealth {
  const [robotStatePublisher, setRobotStatePublisher] = useState<HealthState>("unknown");
  const [trajectoryController, setTrajectoryController] = useState<HealthState>("unknown");
  const [checking, setChecking] = useState(false);

  const checkRobotStatePublisher = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (!ros) {
        setRobotStatePublisher("unknown");
        resolve();
        return;
      }

      setRobotStatePublisher("checking");
      const topic = new ROSLIB.Topic({
        ros,
        name: ROBOT_DESCRIPTION_TOPIC,
        messageType: "std_msgs/String",
      });

      let settled = false;
      const handleMessage = () => {
        if (settled) return;
        settled = true;
        console.log("[node-health] /robot_description arrived — robot_state_publisher active");
        setRobotStatePublisher("active");
        topic.unsubscribe(handleMessage);
        resolve();
      };

      topic.subscribe(handleMessage);
      setTimeout(() => {
        if (settled) return;
        settled = true;
        console.warn("[node-health] /robot_description did not arrive in time — treating as inactive");
        setRobotStatePublisher("inactive");
        topic.unsubscribe(handleMessage);
        resolve();
      }, 2000);
    });
  }, [ros]);

  const checkTrajectoryController = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (!ros || !env) {
        setTrajectoryController("unknown");
        resolve();
        return;
      }

      setTrajectoryController("checking");
      const controllerName = TRAJECTORY_CONTROLLER_NAME_BY_ENV[env];
      const service = new ROSLIB.Service({
        ros,
        name: LIST_CONTROLLERS_SERVICE,
        serviceType: LIST_CONTROLLERS_TYPE,
      });

      console.log("[node-health] calling", LIST_CONTROLLERS_SERVICE, "for", controllerName);
      service.callService(
        {},
        (response: ListControllersResponse) => {
          const match = response.controller?.find((c) => c.name === controllerName);
          console.log("[node-health] list_controllers response", response, "match:", match);
          setTrajectoryController(match?.state === "active" ? "active" : "inactive");
          resolve();
        },
        (error: unknown) => {
          console.error("[node-health] list_controllers service call failed", error);
          setTrajectoryController("inactive");
          resolve();
        }
      );
    });
  }, [ros, env]);

  const refresh = useCallback(() => {
    if (!ros) return;
    setChecking(true);
    Promise.all([checkRobotStatePublisher(), checkTrajectoryController()]).finally(() => {
      setChecking(false);
    });
  }, [ros, checkRobotStatePublisher, checkTrajectoryController]);

  return { robotStatePublisher, trajectoryController, checking, refresh };
}
