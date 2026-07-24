import { useState } from "react";
import * as ROSLIB from "roslib";
import type { URDFRobot } from "urdf-loader";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useGripperPose, GRIPPER_TIP_LINK_BY_ENV } from "@/useGripperPose";
import { useNudgeControl, type Axis } from "@/useNudgeControl";
import type { RobotEnv } from "@/markerFrames";

interface ControlPanelProps {
  ros: ROSLIB.Ros | null;
  env: RobotEnv | null;
  robot: URDFRobot | null;
}

function AxisButtons({
  label,
  axis,
  vertical,
  disabled,
  onNudge,
}: {
  label: string;
  axis: Axis;
  vertical: boolean;
  disabled: boolean;
  onNudge: (axis: Axis, direction: 1 | -1) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ButtonGroup orientation={vertical ? "vertical" : "horizontal"}>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onNudge(axis, 1)}
        >
          +
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onNudge(axis, -1)}
        >
          −
        </Button>
      </ButtonGroup>
    </div>
  );
}

function formatNumber(n: number) {
  return n.toFixed(4);
}

export function ControlPanel({ ros, env, robot }: ControlPanelProps) {
  const [open, setOpen] = useState(false);
  // Only reads from the loaded model while the drawer is actually open —
  // recomposes continuously while open (not a one-shot read), so a second
  // nudge always starts from the arm's true post-first-move position.
  const pose = useGripperPose(robot, env, open);
  const { status, message, nudge } = useNudgeControl(ros);
  const moving = status === "moving";

  const handleNudge = (axis: Axis, direction: 1 | -1) => {
    if (!pose) return;
    nudge(pose, axis, direction);
  };

  const disabled = moving || !ros || !pose;

  return (
    <Drawer direction="left" modal={false} open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full">
          Control
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-72">
        <DrawerHeader>
          <DrawerTitle>Control</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 p-4">
          {env && (
            <p className="text-xs text-muted-foreground">
              Frame: {GRIPPER_TIP_LINK_BY_ENV[env]}
            </p>
          )}
          {!pose && (
            <p className="text-xs text-muted-foreground">
              Waiting for the robot model to load...
            </p>
          )}
          <div className="flex items-start justify-center gap-6">
            <AxisButtons label="X" axis="x" vertical={false} disabled={disabled} onNudge={handleNudge} />
            <AxisButtons label="Y" axis="y" vertical disabled={disabled} onNudge={handleNudge} />
            <AxisButtons label="Z" axis="z" vertical disabled={disabled} onNudge={handleNudge} />
          </div>

          {pose && (
            <div className="flex flex-col gap-1 rounded-md border p-2 font-mono text-xs text-muted-foreground">
              <span>
                pos: x={formatNumber(pose.position.x)} y={formatNumber(pose.position.y)} z=
                {formatNumber(pose.position.z)}
              </span>
              <span>
                rot: x={formatNumber(pose.orientation.x)} y={formatNumber(pose.orientation.y)} z=
                {formatNumber(pose.orientation.z)} w={formatNumber(pose.orientation.w)}
              </span>
            </div>
          )}

          {status === "failed" && message && (
            <p className="text-sm text-destructive">Failed: {message}</p>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Done</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}