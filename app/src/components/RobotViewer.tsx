import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import URDFLoader, { type URDFRobot } from "urdf-loader";
import ROSLIB from "roslib";

interface RobotViewerProps {
  ros: ROSLIB.Ros | null;
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

export function RobotViewer({ ros }: RobotViewerProps) {
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
    <div className="h-full w-full">
      {/* frameloop="always": setJointValue() (called from the /joint_states
          handler above) mutates the URDFRobot's underlying three.js meshes
          directly, outside React's render cycle — R3F's default "demand"
          frameloop only re-renders on tracked prop/state changes, so those
          mutations would never actually get painted without this. */}
      <Canvas frameloop="always" camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 2]} intensity={1} />
        {robot && <primitive object={robot} rotation={[-Math.PI / 2, 0, 0]} />}
      </Canvas>
    </div>
  );
}
