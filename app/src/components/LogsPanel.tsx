import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface LogNodeDef {
  id: string;
  label: string;
}

// Node names confirmed against each node's actual Node() constructor call —
// see calibration_broadcaster_node.cpp, aruco_detector_node.cpp,
// trajectory_planner/main.cpp, image_subscriber_node.cpp,
// depth_perception_node.cpp, calibration_orchestrator_node.cpp,
// planning_scene_setup.cpp, mtc_trajectory.cpp, yolo_marker_bridge_node.py.
// Deliberately excludes: validate_calibration_sim (sim-only ground-truth
// comparison utility, no real-robot counterpart possible) and one-off
// manual/debug scripts under resources/scripts/python/ (capture_camera,
// fov_boundary_sweep, random_pose_capture, tf_debug_markers) — none of these
// are launch-file nodes. No RViz-specific node/plugin exists in this
// project to exclude either (checked — aruco_moveit_config/real_moveit_config
// /etc. only wrap MoveIt's stock generate_moveit_rviz_launch, no custom code).
export const LOG_NODES: LogNodeDef[] = [
  { id: "calibration_broadcaster_node", label: "Calibration broadcaster" },
  { id: "trajectory_planner", label: "Trajectory planner" },
  { id: "aruco_detector_node", label: "ArUco detector" },
  { id: "image_subscriber_node", label: "Image subscriber" },
  { id: "depth_perception_node", label: "Depth perception" },
  { id: "calibration_orchestrator_node", label: "Calibration orchestrator" },
  { id: "planning_scene_setup", label: "Planning scene setup" },
  { id: "mtc_trajectory", label: "MTC trajectory" },
  { id: "yolo_marker_bridge_node", label: "YOLO marker bridge" },
];

interface LogsPanelProps {
  enabledNodes: Set<string>;
  onChange: (enabledNodes: Set<string>) => void;
  logsVisible: boolean;
  onLogsVisibleChange: (visible: boolean) => void;
}

export function LogsPanel({ enabledNodes, onChange, logsVisible, onLogsVisibleChange }: LogsPanelProps) {
  const toggleNode = (nodeId: string, checked: boolean) => {
    const next = new Set(enabledNodes);
    if (checked) next.add(nodeId);
    else next.delete(nodeId);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <Label htmlFor="logs-visible-switch" className="text-sm text-muted-foreground">
          Show Log
        </Label>
        <Switch
          id="logs-visible-switch"
          checked={logsVisible}
          onCheckedChange={onLogsVisibleChange}
        />
      </div>
      <div className="flex flex-col gap-2">
        {LOG_NODES.map((node) => (
          <label key={node.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={enabledNodes.has(node.id)}
              onCheckedChange={(checked) => toggleNode(node.id, checked === true)}
            />
            {node.label}
          </label>
        ))}
      </div>
    </div>
  );
}