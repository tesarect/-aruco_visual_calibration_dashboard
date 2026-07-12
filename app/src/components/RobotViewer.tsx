import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import URDFLoader, { type URDFRobot } from "urdf-loader";
import ROSLIB from "roslib";
import { FrameAxes } from "@/components/FrameAxes";
import { MARKER_FRAMES } from "@/markerFrames";
import type { MarkerVisibilityState } from "@/components/MarkersPanel";

interface RobotViewerProps {
  ros: ROSLIB.Ros | null;
  markerVisibility: MarkerVisibilityState;
}

interface JointStateMessage {
  name: string[];
  position: number[];
}

// Matches vite.config.ts's base:"./" and the /robot/... paths
// extract_urdf.py rewrites mesh references to (see webpage_ws/README.md) —
// fetched relative to the current page, same as every other static asset.
const ROBOT_URDF_PATH = "./robot/robot.urdf";

function useUrdfRobot() {
  const [robot, setRobot] = useState<URDFRobot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = new URDFLoader();
    loader.load(
      ROBOT_URDF_PATH,
      (result) => setRobot(result),
      undefined,
      (err) => setError(err?.message ?? "Failed to load robot URDF")
    );
  }, []);

  return { robot, error };
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

export function RobotViewer({ ros, markerVisibility }: RobotViewerProps) {
  const { robot, error } = useUrdfRobot();
  useJointStates(ros, robot);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-destructive">
        Failed to load robot model: {error}
      </div>
    );
  }

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
            {MARKER_FRAMES.map((frame) => (
              <FrameAxes
                key={frame.id}
                robot={robot}
                linkName={frame.linkName}
                visible={markerVisibility[frame.id] ?? { x: false, y: false, z: false }}
              />
            ))}
          </primitive>
        )}
      </Canvas>
    </div>
  );
}
