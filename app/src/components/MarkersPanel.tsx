import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MARKER_FRAMES } from "@/markerFrames";
import type { AxisVisibility } from "@/components/FrameAxes";

export type MarkerVisibilityState = Record<string, AxisVisibility>;

const ALL_HIDDEN: AxisVisibility = { x: false, y: false, z: false };

function initialState(): MarkerVisibilityState {
  return Object.fromEntries(MARKER_FRAMES.map((f) => [f.id, { ...ALL_HIDDEN }]));
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
    <Card className="w-64">
      <CardHeader>
        <CardTitle>Markers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {MARKER_FRAMES.map((frame) => {
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
      </CardContent>
    </Card>
  );
}