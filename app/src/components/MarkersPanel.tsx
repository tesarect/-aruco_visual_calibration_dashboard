import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { MARKER_FRAMES, CALIBRATED_FRAME_ID } from "@/markerFrames";
import type { AxisVisibility } from "@/components/FrameAxes";

export type MarkerVisibilityState = Record<string, AxisVisibility>;

const ALL_HIDDEN: AxisVisibility = { x: false, y: false, z: false };

// Calibrated frame only exists once a calibration run has completed (see
// CalibratedFrameAxes) but its toggle row is shown alongside the rest from
// the start — same tree-view shape, it just stays dark until broadcast.
const ALL_FRAME_ROWS = [
  ...MARKER_FRAMES.map((f) => ({ id: f.id, label: f.label })),
  { id: CALIBRATED_FRAME_ID, label: "Camera (calibrated)" },
];

function initialState(): MarkerVisibilityState {
  return Object.fromEntries(ALL_FRAME_ROWS.map((f) => [f.id, { ...ALL_HIDDEN }]));
}

const AXIS_LABEL: Record<keyof AxisVisibility, string> = {
  x: "X",
  y: "Y",
  z: "Z",
};

const AXIS_DOT_CLASS: Record<keyof AxisVisibility, string> = {
  x: "bg-red-500",
  y: "bg-green-500",
  z: "bg-blue-500",
};

interface MarkersPanelProps {
  value: MarkerVisibilityState;
  onChange: (value: MarkerVisibilityState) => void;
}

export function useMarkerVisibility() {
  return useState<MarkerVisibilityState>(initialState);
}

export function MarkersPanel({ value, onChange }: MarkersPanelProps) {
  const setAxis = (frameId: string, axis: keyof AxisVisibility, checked: boolean) => {
    onChange({
      ...value,
      [frameId]: { ...value[frameId], [axis]: checked },
    });
  };

  const setAllAxes = (frameId: string, checked: boolean) => {
    onChange({
      ...value,
      [frameId]: { x: checked, y: checked, z: checked },
    });
  };

  return (
    <Drawer direction="left" modal={false}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full">
          Visual Markers
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-72">
        <DrawerHeader>
          <DrawerTitle>Visual Markers</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          {ALL_FRAME_ROWS.map((frame) => {
            const axes = value[frame.id] ?? ALL_HIDDEN;
            const allOn = axes.x && axes.y && axes.z;
            const allOff = !axes.x && !axes.y && !axes.z;

            return (
              <div key={frame.id}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allOn ? true : allOff ? false : "indeterminate"}
                    onCheckedChange={(checked) => setAllAxes(frame.id, checked === true)}
                  />
                  {frame.label}
                </label>
                <div className="ml-6 mt-1 flex flex-col gap-1">
                  {(["x", "y", "z"] as const).map((axis) => (
                    <label key={axis} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={axes[axis]}
                        onCheckedChange={(checked) => setAxis(frame.id, axis, checked === true)}
                      />
                      <span className={`inline-block h-2 w-2 rounded-full ${AXIS_DOT_CLASS[axis]}`} />
                      {AXIS_LABEL[axis]}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
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