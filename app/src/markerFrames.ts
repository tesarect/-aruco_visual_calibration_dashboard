// Real link names confirmed present in the extracted URDF
// (webpage_ws/app/public/robot/robot.urdf) — do not invent names here.
export interface MarkerFrameDef {
  id: string;
  label: string;
  linkName: string;
}

// The calibrated frame is NOT a static URDF link — calibration_broadcaster_node
// only ever broadcasts it (via /tf_static, latched) after a `~/calibrate` run
// completes, parented at `known_chain_frame` (base_link in sim). It has no
// entry in robot.links, so it can't be attached the same way as the other
// three — see CalibratedFrameAxes, which looks it up over TF at runtime and
// parents itself to `known_chain_frame`'s URDF link instead.
export const CALIBRATED_FRAME_ID = "camera_calibrated";
export const CALIBRATED_FRAME_NAME = "wrist_rgbd_camera_depth_optical_frame_calibrated";
export const KNOWN_CHAIN_LINK_NAME = "base_link";

export const MARKER_FRAMES: MarkerFrameDef[] = [
  { id: "camera_optical", label: "Camera (optical frame)", linkName: "wrist_rgbd_camera_depth_optical_frame" },
  { id: "aruco", label: "ArUco frame", linkName: "rg2_gripper_aruco_link" },
  { id: "tool0", label: "Tool0", linkName: "tool0" },
];