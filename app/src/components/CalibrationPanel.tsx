import { useState } from "react";
import ROSLIB from "roslib";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useCalibrationAction, type PlanningMode } from "@/useCalibrationAction";

interface CalibrationPanelProps {
  ros: ROSLIB.Ros | null;
}

export function CalibrationPanel({ ros }: CalibrationPanelProps) {
  const { status, feedback, result, start, stop, setPlanningMode, planningModeError } =
    useCalibrationAction(ros);
  const [planningMode, setPlanningModeLocal] = useState<PlanningMode>("cartesian");
  const running = status === "running";

  const handlePlanningModeChange = (mode: PlanningMode) => {
    setPlanningModeLocal(mode);
    setPlanningMode(mode);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={running || !ros} className="flex-1">
              Calibrate
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={start}>Basic</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={stop} disabled={!running} variant="destructive">
          Cancel
        </Button>
      </div>

      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="text-sm font-medium">Path planning selection</legend>
        <RadioGroup
          value={planningMode}
          onValueChange={(value) => handlePlanningModeChange(value as PlanningMode)}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="cartesian" id="planning-mode-cartesian" />
            <Label htmlFor="planning-mode-cartesian">Cartesian</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="joint_space" id="planning-mode-joint-space" />
            <Label htmlFor="planning-mode-joint-space">Joint space</Label>
          </div>
        </RadioGroup>
        {planningModeError && (
          <p className="text-sm text-destructive">{planningModeError}</p>
        )}
      </fieldset>

      {running && feedback && (
        <p className="text-sm text-muted-foreground">
          Samples: {feedback.samples_collected} / {feedback.samples_total}
        </p>
      )}

      {status === "succeeded" && result && (
        <p className="text-sm text-green-600">
          Done — max spread {result.max_spread_deg.toFixed(1)}°, mean{" "}
          {result.mean_spread_deg.toFixed(1)}°
        </p>
      )}

      {status === "failed" && result && (
        <p className="text-sm text-destructive">Failed: {result.message}</p>
      )}

      {status === "cancelled" && <p className="text-sm text-muted-foreground">Cancelled.</p>}
    </div>
  );
}