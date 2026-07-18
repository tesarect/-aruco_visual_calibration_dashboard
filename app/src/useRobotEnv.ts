import { useEffect, useState } from "react";
import ROSLIB from "roslib";
import type { RobotEnv } from "@/markerFrames";

interface JointStateMessage {
  name: string[];
}

// Sim (RG2 gripper) and real (Robotiq 85 gripper) publish structurally
// different joint names on /joint_states — no new topic/param needed to
// tell them apart, this just reads the one topic the dashboard already
// subscribes to for animating the model. Checked once, off the first
// message received, since which robot is live doesn't change mid-session.
function detectEnv(jointNames: string[]): RobotEnv | null {
  if (jointNames.some((name) => name.startsWith("rg2_gripper"))) return "sim";
  if (jointNames.some((name) => name.startsWith("robotiq_85"))) return "real";
  return null;
}

export function useRobotEnv(ros: ROSLIB.Ros | null) {
  const [env, setEnv] = useState<RobotEnv | null>(null);

  useEffect(() => {
    if (!ros || env) return;

    const jointStates = new ROSLIB.Topic({
      ros,
      name: "/joint_states",
      messageType: "sensor_msgs/JointState",
    });

    const handleMessage = (message: JointStateMessage) => {
      const detected = detectEnv(message.name);
      if (detected) {
        console.log("[robot-env] detected", detected, "from /joint_states");
        setEnv(detected);
      }
    };

    jointStates.subscribe(handleMessage);
    return () => jointStates.unsubscribe(handleMessage);
  }, [ros, env]);

  return env;
}
