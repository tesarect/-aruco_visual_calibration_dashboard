// Real link names confirmed present in the extracted URDF
// (webpage_ws/app/public/robot/robot.urdf) — do not invent names here.
export interface MarkerFrameDef {
  id: string;
  label: string;
  linkName: string;
}

export const MARKER_FRAMES: MarkerFrameDef[] = [
  // { id: "camera", label: "Camera frame", linkName: "wrist_rgbd_camera_link" },
  { id: "camera", label: "Camera frame", linkName: "wrist_rgbd_camera_depth_optical_frame" },
  { id: "camera", label: "Camera frame", linkName: "wrist_rgbd_camera_depth_optical_frame_calibrated" },
  { id: "aruco", label: "ArUco frame", linkName: "rg2_gripper_aruco_link" },
  { id: "tool0", label: "Tool0", linkName: "tool0" },
];