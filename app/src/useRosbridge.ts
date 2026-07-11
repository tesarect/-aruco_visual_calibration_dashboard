import { useCallback, useRef, useState } from "react";
import ROSLIB from "roslib";

export type RosConnectionStatus = "idle" | "connecting" | "connected" | "error";

export function useRosbridge() {
  const [status, setStatus] = useState<RosConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rosRef = useRef<ROSLIB.Ros | null>(null);

  const connect = useCallback((url: string) => {
    rosRef.current?.close();
    setStatus("connecting");
    setErrorMessage(null);

    const ros = new ROSLIB.Ros({ url });
    rosRef.current = ros;

    ros.on("connection", () => setStatus("connected"));
    ros.on("error", (err) => {
      setStatus("error");
      setErrorMessage(err?.toString?.() ?? "Unknown rosbridge connection error");
    });
    ros.on("close", () => setStatus((current) => (current === "error" ? current : "idle")));
  }, []);

  const disconnect = useCallback(() => {
    rosRef.current?.close();
    rosRef.current = null;
    setStatus("idle");
  }, []);

  return { status, errorMessage, connect, disconnect, ros: rosRef.current };
}