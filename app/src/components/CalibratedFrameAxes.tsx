import { useEffect, useRef } from "react";
import * as THREE from "three";
import ROSLIB from "roslib";
import type { URDFRobot } from "urdf-loader";
import type { AxisVisibility } from "@/components/FrameAxes";
import { CALIBRATED_FRAME_NAME_BY_ENV, KNOWN_CHAIN_LINK_NAME, type RobotEnv } from "@/markerFrames";

const AXIS_COLORS: Record<"x" | "y" | "z", number> = {
  x: 0xff3b30,
  y: 0x34c759,
  z: 0x0a84ff,
};

const AXIS_DIRECTIONS: Record<"x" | "y" | "z", THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const AXIS_LENGTH = 0.15;
const CORE_RADIUS = 0.004;
const GLOW_RADIUS = 0.012;

interface TfTransform {
  header: { frame_id: string };
  child_frame_id: string;
  transform: {
    translation: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
  };
}

interface TfMessage {
  transforms: TfTransform[];
}

interface CalibratedFrameAxesProps {
  ros: ROSLIB.Ros | null;
  robot: URDFRobot;
  env: RobotEnv;
  visible: AxisVisibility;
}

/**
 * calibration_broadcaster_node only ever publishes this frame on /tf_static,
 * latched, after a `~/calibrate` run completes — it's not part of the static
 * URDF link tree urdf-loader parses, so (unlike FrameAxes) this has to
 * subscribe to TF directly and parent itself to the known_chain_frame link
 * (base_link in sim) using the looked-up transform as a fixed local offset.
 */
export function CalibratedFrameAxes({ ros, robot, env, visible }: CalibratedFrameAxesProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const attachedRef = useRef(false);

  useEffect(() => {
    const parentLink = robot.links[KNOWN_CHAIN_LINK_NAME];
    if (!parentLink) return;

    const group = new THREE.Group();
    group.visible = false;
    groupRef.current = group;

    // "Light saber" look: a bright, small-radius core cylinder plus a wider,
    // additively-blended, transparent glow cylinder of the same color behind
    // it — real bloom would need a postprocessing pipeline, this fakes the
    // same read (thicker + glowing) with two plain meshes.
    (["x", "y", "z"] as const).forEach((axis) => {
      const axisGroup = new THREE.Group();
      axisGroup.name = `axis-${axis}`;

      const direction = AXIS_DIRECTIONS[axis];
      const midpoint = direction.clone().multiplyScalar(AXIS_LENGTH / 2);
      const orientToAxis = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
      );

      const coreGeometry = new THREE.CylinderGeometry(CORE_RADIUS, CORE_RADIUS, AXIS_LENGTH, 8);
      const coreMaterial = new THREE.MeshBasicMaterial({ color: AXIS_COLORS[axis] });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      core.position.copy(midpoint);
      core.quaternion.copy(orientToAxis);
      axisGroup.add(core);

      const glowGeometry = new THREE.CylinderGeometry(GLOW_RADIUS, GLOW_RADIUS, AXIS_LENGTH, 8);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: AXIS_COLORS[axis],
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.copy(midpoint);
      glow.quaternion.copy(orientToAxis);
      axisGroup.add(glow);

      group.add(axisGroup);
    });

    parentLink.add(group);
    attachedRef.current = true;

    return () => {
      parentLink.remove(group);
      group.children.forEach((axisGroup) => {
        axisGroup.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      });
      attachedRef.current = false;
    };
  }, [robot]);

  useEffect(() => {
    if (!ros) return;

    // /tf_static is transient-local (latched) — a fresh subscription still
    // receives the transform even if calibration finished before this
    // component mounted.
    const tfStatic = new ROSLIB.Topic({
      ros,
      name: "/tf_static",
      messageType: "tf2_msgs/TFMessage",
    });

    const calibratedFrameName = CALIBRATED_FRAME_NAME_BY_ENV[env];
    const handleMessage = (message: TfMessage) => {
      const match = message.transforms.find((t) => t.child_frame_id === calibratedFrameName);
      if (!match || !groupRef.current) return;

      const { translation, rotation } = match.transform;
      groupRef.current.position.set(translation.x, translation.y, translation.z);
      groupRef.current.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      groupRef.current.visible = true;
    };

    tfStatic.subscribe(handleMessage);
    return () => tfStatic.unsubscribe(handleMessage);
  }, [ros, env]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    (["x", "y", "z"] as const).forEach((axis) => {
      const axisGroup = group.getObjectByName(`axis-${axis}`);
      if (axisGroup) axisGroup.visible = visible[axis];
    });
  }, [visible]);

  return null;
}