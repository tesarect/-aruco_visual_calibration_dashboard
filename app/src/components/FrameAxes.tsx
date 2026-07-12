import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

// REP-103 / RViz convention: X=red, Y=green, Z=blue.
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

export interface AxisVisibility {
  x: boolean;
  y: boolean;
  z: boolean;
}

interface FrameAxesProps {
  robot: URDFRobot;
  linkName: string;
  visible: AxisVisibility;
}

/**
 * Attaches a small colored XYZ line triad to a named URDF link, so it
 * inherits that link's live transform via the three.js scene graph
 * (robot.links[name].add(...)) — no manual matrix/TF math needed, since
 * urdf-loader already keeps every link's world transform correct as
 * setJointValue() runs. Each axis is independently toggleable per the
 * user's requested tree-view checkbox granularity.
 */
export function FrameAxes({ robot, linkName, visible }: FrameAxesProps) {
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const link = robot.links[linkName];
    if (!link) return;

    const group = new THREE.Group();
    groupRef.current = group;

    (["x", "y", "z"] as const).forEach((axis) => {
      const points = [new THREE.Vector3(0, 0, 0), AXIS_DIRECTIONS[axis].clone().multiplyScalar(AXIS_LENGTH)];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: AXIS_COLORS[axis] });
      const line = new THREE.Line(geometry, material);
      line.name = `axis-${axis}`;
      group.add(line);
    });

    link.add(group);

    return () => {
      link.remove(group);
      group.children.forEach((child) => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    };
    // Re-run if the robot instance itself changes (e.g. reloaded) — a
    // stale `link` reference from a prior URDFRobot would silently no-op.
  }, [robot, linkName]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    (["x", "y", "z"] as const).forEach((axis) => {
      const line = group.getObjectByName(`axis-${axis}`);
      if (line) line.visible = visible[axis];
    });
  }, [visible]);

  return null;
}