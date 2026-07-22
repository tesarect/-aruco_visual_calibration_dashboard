import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { TrailPoint } from "@/useGripperTrail";

const OLD_COLOR = new THREE.Color("#ffffff");
const RECENT_COLOR = new THREE.Color("#ff2d2d");
const CORE_LINEWIDTH = 1;
const GLOW_LINEWIDTH = 4;
const GLOW_OPACITY = 0.3;

interface GripperTrailProps {
  points: TrailPoint[];
}

/**
 * Renders the gripper's accumulated position history as a glowing path,
 * faded from white (oldest end) to red (most recent/freshest end) — same
 * "light saber" double-line technique as CalibratedFrameAxes (a thin bright core
 * plus a wider, additively-blended, transparent glow), but with per-vertex
 * color instead of one fixed color, since a trail's whole point is showing
 * recency. Uses drei's Line (Line2/LineMaterial under the hood, supports
 * vertexColors) rather than plain THREE.Line — LineBasicMaterial.linewidth
 * is silently ignored on most platforms (a well-known WebGL/ANGLE
 * limitation) and it has no per-vertex color support either, so a fat
 * gradient line needs the fat-line shader implementation, not the vanilla
 * material.
 *
 * Rendered as a normal R3F JSX child of the same <primitive object={robot}>
 * tree RobotViewer already renders the marker frames under, so it inherits
 * the same base_link-relative coordinate space useGripperPose composes its
 * poses in (see useGripperPose.ts) — no extra parenting/transform code
 * needed here, unlike CalibratedFrameAxes which has to attach itself
 * imperatively because its frame isn't part of the static URDF tree at all.
 */
export function GripperTrail({ points }: GripperTrailProps) {
  if (points.length < 2) return null;

  const positions = points.map((p) => [p.x, p.y, p.z] as [number, number, number]);
  const colors = points.map((_, i) => {
    const t = i / (points.length - 1); // 0 = oldest, 1 = most recent
    return OLD_COLOR.clone().lerp(RECENT_COLOR, t).toArray() as [number, number, number];
  });

  return (
    <>
      <Line
        points={positions}
        vertexColors={colors}
        lineWidth={CORE_LINEWIDTH}
        toneMapped={false}
      />
      <Line
        points={positions}
        vertexColors={colors}
        lineWidth={GLOW_LINEWIDTH}
        transparent
        opacity={GLOW_OPACITY}
        toneMapped={false}
        depthWrite={false}
      />
    </>
  );
}
