import { Button } from "@/components/ui/button";

// No backing ROS interface exists yet for named preset poses —
// trajectory_planner only exposes ~/trace_path (arbitrary waypoints) and
// ~/trace_polygon (a parameterized polygon), neither of which map to a named
// "Home"/"Cal Ready"/etc. preset. Rendered disabled per the project's rule:
// no button without a real backing interface.
const ROW_ONE = ["Home", "Cal Ready", "Preset 1", "Preset 2"];
const ROW_TWO = ["Barista", "Holder 2", "Holder 3", "Holder 4"];

export function PresetPositionsPanel() {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {ROW_ONE.map((label) => (
          <Button key={label} variant="outline" size="sm" disabled>
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ROW_TWO.map((label) => (
          <Button key={label} variant="outline" size="sm" disabled>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}