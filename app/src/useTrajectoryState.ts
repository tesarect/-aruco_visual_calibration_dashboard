import { useEffect, useState } from "react";
import * as ROSLIB from "roslib";

const CURRENT_POSE_NAME_TOPIC = "/trajectory_planner/current_pose_name";
const PLANNING_FAILURE_TOPIC = "/trajectory_planner/planning_failure";

interface StringMessage {
  data: string;
}

export interface PlanningFailure {
  id: number;
  context: string;
  message: string;
}

interface PlanningFailureMessage {
  context: string;
  message: string;
}

/**
 * ~/current_pose_name is std_msgs/String, transient_local — a late-
 * subscribing page load/reconnect gets the last published value immediately,
 * no need to wait for the next move (trajectory_planner.cpp).
 * ~/planning_failure is visual_calibration_msgs/msg/PlanningFailure, plain
 * reliable (NOT latched) — published once per failure event only, so this
 * only ever reflects failures that happened while connected, same as any
 * other live event stream.
 *
 * All stay/lift/standby sequencing decisions live entirely in
 * trajectory_planner — this hook only ever reads these two topics and
 * exposes their raw values, no client-side state machine.
 */
export function useTrajectoryState(ros: ROSLIB.Ros | null) {
  const [currentPoseName, setCurrentPoseName] = useState<string | null>(null);
  const [latestFailure, setLatestFailure] = useState<PlanningFailure | null>(null);

  useEffect(() => {
    if (!ros) return;

    const currentPoseNameTopic = new ROSLIB.Topic({
      ros,
      name: CURRENT_POSE_NAME_TOPIC,
      messageType: "std_msgs/String",
    });

    const handlePoseName = (message: StringMessage) => {
      console.log("[trajectory-state] current_pose_name", message.data);
      setCurrentPoseName(message.data);
    };

    currentPoseNameTopic.subscribe(handlePoseName);
    return () => currentPoseNameTopic.unsubscribe(handlePoseName);
  }, [ros]);

  useEffect(() => {
    if (!ros) return;

    const planningFailureTopic = new ROSLIB.Topic({
      ros,
      name: PLANNING_FAILURE_TOPIC,
      messageType: "visual_calibration_msgs/msg/PlanningFailure",
    });

    let nextId = 0;
    const handleFailure = (message: PlanningFailureMessage) => {
      console.warn("[trajectory-state] planning_failure", message);
      setLatestFailure({ id: nextId++, context: message.context, message: message.message });
    };

    planningFailureTopic.subscribe(handleFailure);
    return () => planningFailureTopic.unsubscribe(handleFailure);
  }, [ros]);

  const dismissFailure = () => setLatestFailure(null);

  return { currentPoseName, latestFailure, dismissFailure };
}