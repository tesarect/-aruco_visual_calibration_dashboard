import { Checkbox } from "@/components/ui/checkbox";

export interface LogNodeDef {
  id: string;
  label: string;
}

// Node names confirmed against each node's actual Node() constructor call —
// see calibration_broadcaster_node.cpp, aruco_detector_node.cpp,
// trajectory_planner/main.cpp.
export const LOG_NODES: LogNodeDef[] = [
  { id: "calibration_broadcaster_node", label: "Calibration broadcaster" },
  { id: "trajectory_planner", label: "Trajectory planner" },
  { id: "aruco_detector_node", label: "ArUco detector" },
];

interface LogsPanelProps {
  enabledNodes: Set<string>;
  onChange: (enabledNodes: Set<string>) => void;
}

export function LogsPanel({ enabledNodes, onChange }: LogsPanelProps) {
  const toggleNode = (nodeId: string, checked: boolean) => {
    const next = new Set(enabledNodes);
    if (checked) next.add(nodeId);
    else next.delete(nodeId);
    onChange(next);
  };

  return (
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
  );
}