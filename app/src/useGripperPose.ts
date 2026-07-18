import { useEffect, useState } from "react";
import * as THREE from "three";
import ROSLIB from "roslib";
import type { RobotEnv } from "@/markerFrames";

// Gripper tip per env, plus the exact ordered chain of links from base_link
// to that tip (confirmed against ur_macro.xacro / rg2_gripper.urdf.xacro /
// real_ur3e_robotiq85.urdf.xacro — every joint in this chain, no skips).
// The 6 arm joints (shoulder_pan_joint .. wrist_3_joint) are revolute, so
// their transforms live on /tf and update continuously as the arm moves;
// every other joint here is fixed (published once, latched, on /tf_static).
// Composing this chain ourselves (rather than trusting a single "base_link
// -> tip" TF entry, which /tf never actually publishes — only individual
// joint transforms exist) is exactly what tf2 itself does; this can be
// cross-checked against `ros2 run tf2_ros tf2_echo base_link <tip>`.
export const GRIPPER_TIP_LINK_BY_ENV: Record<RobotEnv, string> = {
  sim: "rg2_gripper_aruco_link",
  real: "robotiq_85_base_link",
};

const CHAIN_LINKS_BY_ENV: Record<RobotEnv, string[]> = {
  sim: [
    "base_link",
    "base_link_inertia",
    "shoulder_link",
    "upper_arm_link",
    "forearm_link",
    "wrist_1_link",
    "wrist_2_link",
    "wrist_3_link",
    "flange",
    "tool0",
    "rg2_gripper_base_link",
    "rg2_gripper_aruco_link",
  ],
  real: [
    "base_link",
    "base_link_inertia",
    "shoulder_link",
    "upper_arm_link",
    "forearm_link",
    "wrist_1_link",
    "wrist_2_link",
    "wrist_3_link",
    "flange",
    "tool0",
    "robotiq_85_base_link",
  ],
};

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  position: Position;
  orientation: { x: number; y: number; z: number; w: number };
}

interface TfTransform {
  header: { frame_id: string };
  child_frame_id: string;
  transform: {
    translation: Position;
    rotation: { x: number; y: number; z: number; w: number };
  };
}

interface TfMessage {
  transforms: TfTransform[];
}

function transformToMatrix(t: TfTransform["transform"]): THREE.Matrix4 {
  const position = new THREE.Vector3(t.translation.x, t.translation.y, t.translation.z);
  const quaternion = new THREE.Quaternion(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
  return new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(1, 1, 1));
}

function composeChain(
  chainLinks: string[],
  transformsByChildFrame: Map<string, TfTransform>
): Pose | null {
  let matrix = new THREE.Matrix4(); // identity — represents base_link -> base_link
  for (let i = 1; i < chainLinks.length; i++) {
    const childLink = chainLinks[i];
    const hop = transformsByChildFrame.get(childLink);
    if (!hop) return null; // haven't received this joint's transform yet
    matrix = matrix.multiply(transformToMatrix(hop.transform));
  }

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);

  return {
    position: { x: position.x, y: position.y, z: position.z },
    orientation: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
  };
}

/**
 * Live base_link -> gripper-tip pose, composed client-side from the
 * individual joint transforms on /tf (dynamic) and /tf_static (fixed) —
 * only subscribed while `enabled` is true (the Control drawer being open),
 * so this doesn't run continuously in the background. Recomposes on every
 * incoming transform while enabled, so a second nudge always starts from
 * the arm's true post-first-move position, not a stale one-shot reading.
 */
export function useGripperPose(ros: ROSLIB.Ros | null, env: RobotEnv | null, enabled: boolean) {
  const [pose, setPose] = useState<Pose | null>(null);

  useEffect(() => {
    setPose(null);
    if (!ros || !env || !enabled) return;

    const chainLinks = CHAIN_LINKS_BY_ENV[env];
    const transformsByChildFrame = new Map<string, TfTransform>();

    const recompose = () => {
      const composed = composeChain(chainLinks, transformsByChildFrame);
      if (composed) setPose(composed);
    };

    const handleMessage = (message: TfMessage) => {
      let relevant = false;
      for (const t of message.transforms) {
        if (chainLinks.includes(t.child_frame_id)) {
          transformsByChildFrame.set(t.child_frame_id, t);
          relevant = true;
        }
      }
      if (relevant) recompose();
    };

    const tf = new ROSLIB.Topic({ ros, name: "/tf", messageType: "tf2_msgs/TFMessage" });
    const tfStatic = new ROSLIB.Topic({ ros, name: "/tf_static", messageType: "tf2_msgs/TFMessage" });
    tf.subscribe(handleMessage);
    tfStatic.subscribe(handleMessage);

    return () => {
      tf.unsubscribe(handleMessage);
      tfStatic.unsubscribe(handleMessage);
    };
  }, [ros, env, enabled]);

  return pose;
}