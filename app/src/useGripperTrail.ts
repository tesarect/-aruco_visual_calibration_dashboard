import { useEffect, useRef, useState } from "react";
import type { Pose } from "@/useGripperPose";

// Cap on accumulated trail points — old points drop off the front once this
// is hit, so the trail doesn't grow unbounded over a long session. At a
// modest /tf publish rate this is several minutes of continuous motion
// before the oldest points start rolling off, plenty for "where has the
// gripper been recently" without ever ballooning memory/geometry.
const MAX_TRAIL_POINTS = 2000;

export interface TrailPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Accumulates gripper positions into a capped trail while `enabled` is true.
 * Unlike useGripperPose (which only holds the latest pose), this keeps the
 * running history so it can be drawn as a path line. Per explicit design:
 * toggling `enabled` off does NOT clear the trail (it just stops growing) —
 * only a fresh off->on transition resets it, so flipping the switch back on
 * always starts a clean new trail rather than continuing/appending to the
 * old one.
 */
export function useGripperTrail(pose: Pose | null, enabled: boolean) {
  const [points, setPoints] = useState<TrailPoint[]>([]);
  const wasEnabledRef = useRef(false);

  useEffect(() => {
    if (enabled && !wasEnabledRef.current) {
      console.log("[gripper-trail] enabled — resetting trail");
      setPoints([]);
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pose) return;
    setPoints((prev) => {
      const next = [...prev, { x: pose.position.x, y: pose.position.y, z: pose.position.z }];
      return next.length > MAX_TRAIL_POINTS ? next.slice(next.length - MAX_TRAIL_POINTS) : next;
    });
  }, [pose, enabled]);

  return points;
}
