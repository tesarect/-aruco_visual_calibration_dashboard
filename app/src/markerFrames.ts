export type RobotEnv = "sim" | "real";

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
// Per-env, since sim's and real's camera optical frame names differ (see
// KNOWN_CHAIN_LINK_NAME_BY_ENV below for the same reasoning applied to the
// calibrated frame's parent link).
export const CALIBRATED_FRAME_NAME_BY_ENV: Record<RobotEnv, string> = {
  sim: "wrist_rgbd_camera_depth_optical_frame_calibrated",
  real: "camera_depth_optical_frame_calibrated",
};
export const KNOWN_CHAIN_LINK_NAME = "base_link";

// Real link names confirmed present in each env's extracted URDF
// (public/robot/<env>/robot.urdf) — do not invent names here. Sim (RG2
// gripper) and real (Robotiq 85 gripper, SRDF chain extended to
// robotiq_85_base_link per todo.txt's 2026-07-18 note) have structurally
// different kinematic chains, so this is env-specific rather than one
// shared list.
//
// Real has no "ArUco frame" row yet: per todo.txt's explicit warning, the
// only real ArUco-marker TF frame today comes from an ad-hoc, manually-
// started process outside any launch file — not something to build UI
// around. Once B2/perception lands, real's ArUco pose will come from
// /aruco_perception/marker_pose (a live PoseStamped, not a static URDF
// link) — that'll need its own topic-driven axis component, same pattern
// as CalibratedFrameAxes.tsx, not an entry in this static list.
export const MARKER_FRAMES_BY_ENV: Record<RobotEnv, MarkerFrameDef[]> = {
  sim: [
    { id: "camera_optical", label: "Camera (optical frame)", linkName: "wrist_rgbd_camera_depth_optical_frame" },
    { id: "aruco", label: "ArUco frame", linkName: "rg2_gripper_aruco_link" },
    { id: "tool0", label: "Tool0", linkName: "tool0" },
  ],
  real: [
    { id: "camera_optical", label: "Camera (optical frame)", linkName: "camera_depth_optical_frame" },
    { id: "gripper", label: "Gripper", linkName: "robotiq_85_base_link" },
  ],
};