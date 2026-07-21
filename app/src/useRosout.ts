import { useEffect, useRef, useState } from "react";
import * as ROSLIB from "roslib";

// rcl_interfaces/msg/Log level constants (/opt/ros/humble/share/rcl_interfaces/msg/Log.msg)
export const LOG_LEVEL = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, FATAL: 50 } as const;

interface RosoutMessage {
  stamp: { sec: number; nanosec: number };
  level: number;
  name: string;
  msg: string;
}

export interface LogLine {
  id: number;
  nodeName: string;
  level: number;
  message: string;
}

const MAX_LINES = 20;

/**
 * Every ROS2 node publishes to /rosout by default (rcl_interfaces/msg/Log) —
 * this is node-level logging, not raw launch/tmux stdout, which rosbridge
 * has no access to at all. `enabledNodes` filters by the message's `name`
 * field client-side; an empty set shows nothing (not "show all"), matching
 * the checkbox-driven selective display this was built for.
 */
export function useRosout(ros: ROSLIB.Ros | null, enabledNodes: Set<string>) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const nextIdRef = useRef(0);
  const enabledNodesRef = useRef(enabledNodes);
  enabledNodesRef.current = enabledNodes;

  useEffect(() => {
    if (!ros) return;

    const rosout = new ROSLIB.Topic({
      ros,
      name: "/rosout",
      messageType: "rcl_interfaces/msg/Log",
    });

    const handleMessage = (message: RosoutMessage) => {
      if (!enabledNodesRef.current.has(message.name)) return;

      const line: LogLine = {
        id: nextIdRef.current++,
        nodeName: message.name,
        level: message.level,
        message: message.msg,
      };

      setLines((prev) => [...prev, line].slice(-MAX_LINES));
    };

    rosout.subscribe(handleMessage);
    return () => rosout.unsubscribe(handleMessage);
  }, [ros]);

  return lines;
}