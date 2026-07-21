import * as ROSLIB from "roslib";
import { Button } from "@/components/ui/button";
import { useTrajectoryPlanner } from "@/useTrajectoryPlanner";

interface PresetPositionsPanelProps {
  ros: ROSLIB.Ros | null;
}

// "Holder 1-4" have no backing ROS interface yet — trajectory_planner's
// preset_names (preset_poses_{sim,real}.yaml) currently defines "home",
// "standby", "baristastandby", "cal_ready"/"standoff" — all four now wired
// below. Holder buttons remain disabled per the project's rule: no button
// without a real backing interface.
const ROW_ONE = ["Home", "Cal Ready", "Standby", "B'Standby"];
const ROW_TWO = ["Holder 1", "Holder 2", "Holder 3", "Holder 4"];

// label -> ~/get_preset_pose preset name, confirmed against preset_names in
// preset_poses_sim.yaml/preset_poses_real.yaml (both envs already define
// these keys, though real's baristastandby value is still a rough/unfixed
// measurement per project notes — the button itself works identically
// either way, it's the pose data that's still pending on real).
const PRESET_NAME_BY_LABEL: Record<string, string> = {
  Home: "home",
  "B'Standby": "baristastandby",
};

export function PresetPositionsPanel({ ros }: PresetPositionsPanelProps) {
  const { status, message, moveToStandoff, moveToPreset } = useTrajectoryPlanner(ros);
  const moving = status === "moving";

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {ROW_ONE.map((label) => {
          if (label === "Cal Ready") {
            return (
              <Button
                key={label}
                variant="outline"
                size="sm"
                disabled={moving || !ros}
                onClick={moveToStandoff}
              >
                {label}
              </Button>
            );
          }
          if (label === "Standby") {
            return (
              <Button
                key={label}
                variant="outline"
                size="sm"
                disabled={moving || !ros}
                onClick={() => moveToPreset("standby")}
              >
                {label}
              </Button>
            );
          }
          const presetName = PRESET_NAME_BY_LABEL[label];
          if (presetName) {
            return (
              <Button
                key={label}
                variant="outline"
                size="sm"
                disabled={moving || !ros}
                onClick={() => moveToPreset(presetName)}
              >
                {label}
              </Button>
            );
          }
          return (
            <Button key={label} variant="outline" size="sm" disabled>
              {label}
            </Button>
          );
        })}
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
      {status === "succeeded" && <p className="text-sm text-green-600">Move succeeded.</p>}
    </div>
  );
}