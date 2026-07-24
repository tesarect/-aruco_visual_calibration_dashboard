import { useEffect, useState } from "react";
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";
import type { RobotEnv } from "@/markerFrames";

export const GRIPPER_TIP_LINK_BY_ENV: Record<RobotEnv, string> = {
  sim: "rg2_gripper_aruco_link",
  real: "robotiq_85_base_link",
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

// Reads the live base_link -> gripper-tip pose straight off the already-
// loaded URDFRobot's scene graph, instead of composing it ourselves from
// /tf + /tf_static. RobotViewer's useJointStates() already calls
// robot.setJointValue() on every /joint_states message, and urdf-loader
// keeps every link's matrixWorld correct as that happens (same fact
// FrameAxes.tsx's doc comment already relies on) — so robot.links[tip]
// .matrixWorld is already the right answer, fixed joints and moving joints
// alike, with zero extra TF subscription needed.
//
// This replaces an earlier version that manually re-composed the chain from
// live /tf (moving joints) + /tf_static (fixed joints, e.g.
// base_link_inertia, flange, tool0). That worked on sim but failed on real:
// confirmed via debug logging that base_link_inertia's one-time /tf_static
// broadcast never reached the browser's websocket subscription (a latching
// race — the transform genuinely exists, per a saved tf2_tools view_frames
// capture in real_information_observations.md, average rate 10000 = static,
// so this wasn't a missing/renamed frame, just a delivery timing gap
// specific to that transport path). Reading the same data out of the loaded
// robot.urdf (already fetched once via extract_urdf.py and meant to be
// git-tracked) sidesteps that race entirely — no live TF wait for anything
// this hook needs.
function readPoseFromModel(robot: URDFRobot, tipLinkName: string): Pose | null {
  const baseLink = robot.links["base_link"];
  const tipLink = robot.links[tipLinkName];
  if (!baseLink || !tipLink) return null;

  baseLink.updateWorldMatrix(true, false);
  tipLink.updateWorldMatrix(true, false);

  // tip-relative-to-base_link = inverse(base_link world) * tip world —
  // cancels out RobotViewer's outer display rotation on <primitive> and any
  // scene-graph position, leaving a pure base_link -> tip transform (the
  // same relationship the old TF-chain composition was computing by hand).
  const baseWorldInverse = new THREE.Matrix4().copy(baseLink.matrixWorld).invert();
  const relative = new THREE.Matrix4().multiplyMatrices(baseWorldInverse, tipLink.matrixWorld);

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  relative.decompose(position, quaternion, scale);

  return {
    position: { x: position.x, y: position.y, z: position.z },
    orientation: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
  };
}

/**
 * Live base_link -> gripper-tip pose, read directly from the loaded
 * URDFRobot model — only active while `enabled` is true (the Control
 * drawer being open, or the Dev Space trail switch), polling on an
 * animation-frame-ish interval rather than a TF subscription, since the
 * pose now depends on the model's own live-updated matrixWorld rather than
 * an incoming ROS message.
 */
export function useGripperPose(robot: URDFRobot | null, env: RobotEnv | null, enabled: boolean) {
  const [pose, setPose] = useState<Pose | null>(null);

  useEffect(() => {
    setPose(null);
    if (!robot || !env || !enabled) return;

    const tipLinkName = GRIPPER_TIP_LINK_BY_ENV[env];
    console.log("[gripper-pose] enabled — reading from loaded model", { env, tipLinkName });

    let missingLinkLogged = false;
    const intervalId = window.setInterval(() => {
      const composed = readPoseFromModel(robot, tipLinkName);
      if (composed) {
        setPose(composed);
      } else if (!missingLinkLogged) {
        missingLinkLogged = true;
        console.warn(
          "[gripper-pose] base_link or",
          tipLinkName,
          "not found in the loaded URDF's link tree"
        );
      }
    }, 100);

    return () => {
      console.log("[gripper-pose] disabled — stopping model reads");
      window.clearInterval(intervalId);
    };
  }, [robot, env, enabled]);

  return pose;
}
