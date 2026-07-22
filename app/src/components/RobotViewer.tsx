import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import URDFLoader, { type URDFRobot } from "urdf-loader";
import * as THREE from "three";
import * as ROSLIB from "roslib";
import { FrameAxes } from "@/components/FrameAxes";
import { CalibratedFrameAxes } from "@/components/CalibratedFrameAxes";
import { GripperTrail } from "@/components/GripperTrail";
import { MARKER_FRAMES_BY_ENV, CALIBRATED_FRAME_ID, type RobotEnv } from "@/markerFrames";
import type { MarkerVisibilityState } from "@/components/MarkersPanel";
import type { TrailPoint } from "@/useGripperTrail";

const ARM_TRANSPARENT_OPACITY = 0.4;

interface RobotViewerProps {
  ros: ROSLIB.Ros | null;
  env: RobotEnv | null;
  markerVisibility: MarkerVisibilityState;
  trailPoints: TrailPoint[];
  armTransparent: boolean;
}

interface JointStateMessage {
  name: string[];
  position: number[];
}

// Matches vite.config.ts's base:"./" and the /robot/... paths
// extract_urdf.py rewrites mesh references to (see webpage_ws/README.md) —
// fetched relative to the current page, same as every other static asset.
// Sim (RG2 gripper) and real (Robotiq 85 gripper) have structurally
// different kinematic chains, so each env's extraction writes to its own
// subtree (public/robot/<env>/) rather than one shared robot.urdf that gets
// silently overwritten by whichever environment was extracted last — see
// scripts/extract_urdf.py's --env flag.
function robotUrdfPath(env: RobotEnv) {
  return `./robot/${env}/robot.urdf`;
}

function useUrdfRobot(env: RobotEnv | null) {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!env) return;

    const loader = new URDFLoader();
    loader.load(
      robotUrdfPath(env),
      (result) => setRobot(result),
      undefined,
      (err) => setError(err?.message ?? "Failed to load robot URDF")
    );
  }, [env]);

  return { robot, error };
}

// Applies/reverts transparency across every mesh material in the loaded
// URDF — straightforward Three.js material mutation (transparent + opacity),
// not a shader/postprocessing effect, since urdf-loader's robot is just a
// normal Object3D tree of meshes. Materials can be shared across multiple
// meshes (common when several links reuse the same color), so this mutates
// each unique material instance once via a Set, not once per mesh.
function useArmTransparency(robot: URDFRobot | null, transparent: boolean) {
  useEffect(() => {
    if (!robot) return;

    const materials = new Set<THREE.Material>();
    robot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((m) => materials.add(m));
        } else if (material) {
          materials.add(material);
        }
      }
    });

    materials.forEach((material) => {
      material.transparent = transparent;
      material.opacity = transparent ? ARM_TRANSPARENT_OPACITY : 1;
      material.depthWrite = !transparent;
      material.needsUpdate = true;
    });
  }, [robot, transparent]);
}

function useJointStates(ros: ROSLIB.Ros | null, robot: URDFRobot | null) {
  useEffect(() => {
    if (!ros || !robot) return;

    const jointStates = new ROSLIB.Topic({
      ros,
      name: "/joint_states",
      messageType: "sensor_msgs/JointState",
    });

    const handleMessage = (message: JointStateMessage) => {
      message.name.forEach((jointName, i) => {
        const position = message.position[i];
        if (jointName in robot.joints && position !== undefined) {
          robot.setJointValue(jointName, position);
        }
      });
    };

    jointStates.subscribe(handleMessage);
    return () => jointStates.unsubscribe(handleMessage);
  }, [ros, robot]);
}

export function RobotViewer({ ros, env, markerVisibility, trailPoints, armTransparent }: RobotViewerProps) {
  const { robot, error } = useUrdfRobot(env);
  useJointStates(ros, robot);
  useArmTransparency(robot, armTransparent);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-destructive">
        Failed to load robot model: {error} (check robot.urdf)
      </div>
    );
  }

  if (!env) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Waiting for /joint_states to detect sim vs. real...
      </div>
    );
  }

  const markerFrames = MARKER_FRAMES_BY_ENV[env];

  return (
    <div
      className="h-full w-full"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #1e293b 0%, #0f172a 45%, #020617 100%)",
      }}
    >
      {/* frameloop="always": setJointValue() (called from the /joint_states
          handler above) mutates the URDFRobot's underlying three.js meshes
          directly, outside React's render cycle — R3F's default "demand"
          frameloop only re-renders on tracked prop/state changes, so those
          mutations would never actually get painted without this. */}
      <Canvas
        frameloop="always"
        camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}
        gl={{ alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 2]} intensity={1} />
        {/* Distant "sun" light from high overhead, for extra depth/shading
            on top of the closer fill light above. */}
        <directionalLight position={[0, 20, 0]} intensity={0.6} />
        {/* Click-drag to orbit, scroll to zoom, right-click-drag to pan —
            the standard @react-three/fiber camera control component. */}
        <OrbitControls makeDefault />
        {robot && (
          <primitive object={robot} rotation={[-Math.PI / 2, 0, 0]}>
            {markerFrames.map((frame) => (
              <FrameAxes
                key={frame.id}
                robot={robot}
                linkName={frame.linkName}
                visible={markerVisibility[frame.id] ?? { x: false, y: false, z: false }}
              />
            ))}
            <CalibratedFrameAxes
              ros={ros}
              robot={robot}
              env={env}
              visible={markerVisibility[CALIBRATED_FRAME_ID] ?? { x: false, y: false, z: false }}
            />
            <GripperTrail points={trailPoints} />
          </primitive>
        )}
      </Canvas>
    </div>
  );
}
