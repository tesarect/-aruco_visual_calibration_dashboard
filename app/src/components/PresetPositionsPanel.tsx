import ROSLIB from "roslib";
import { Button } from "@/components/ui/button";
import { useTrajectoryPlanner } from "@/useTrajectoryPlanner";

interface PresetPositionsPanelProps {
  ros: ROSLIB.Ros | null;
}

// "Home"/"Preset 1"/"Preset 2"/"Barista"/"Holder 2-4" have no backing ROS
// interface yet — trajectory_planner's preset_names only defines "standoff"
// (preset_poses_real.yaml), which "Cal Ready" maps to. Those remain disabled
// per the project's rule: no button without a real backing interface.
const ROW_ONE = ["Home", "Cal Ready", "Preset 1", "Preset 2"];
const ROW_TWO = ["Barista", "Holder 2", "Holder 3", "Holder 4"];

export function PresetPositionsPanel({ ros }: PresetPositionsPanelProps) {
  const { status, message, moveToStandoff } = useTrajectoryPlanner(ros);
  const moving = status === "moving";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {ROW_ONE.map((label) =>
          label === "Cal Ready" ? (
            <Button
              key={label}
              variant="outline"
              size="sm"
              disabled={moving || !ros}
              onClick={moveToStandoff}
            >
              {label}
            </Button>
          ) : (
            <Button key={label} variant="outline" size="sm" disabled>
              {label}
            </Button>
          )
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ROW_TWO.map((label) => (
          <Button key={label} variant="outline" size="sm" disabled>
            {label}
          </Button>
        ))}
      </div>
      {status === "failed" && message && (
        <p className="text-sm text-destructive">Failed: {message}</p>
      )}
      {status === "succeeded" && <p className="text-sm text-green-600">At standoff pose.</p>}
    </div>
  );
}