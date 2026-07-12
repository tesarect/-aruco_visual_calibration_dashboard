import { useCallback, useRef, useState } from "react";
import ROSLIB from "roslib";

export type RosConnectionStatus = "idle" | "connecting" | "connected" | "error";

const RECONNECT_DELAY_MS = 2000;

export function useRosbridge() {
  const [status, setStatus] = useState<RosConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const rosRef = useRef<ROSLIB.Ros | null>(null);
  const urlRef = useRef<string | null>(null);
  // Reverse proxies (e.g. nginx) commonly close idle WebSocket connections
  // after a timeout — that's a transient close, not a real disconnect, so
  // it shouldn't kick the user back to the landing page. Only an explicit
  // disconnect() call should stop auto-reconnect attempts.
  const explicitDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback((url: string) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    rosRef.current?.close();
    explicitDisconnectRef.current = false;
    urlRef.current = url;
    setStatus("connecting");
    setErrorMessage(null);

    const ros = new ROSLIB.Ros({ url });
    rosRef.current = ros;

    ros.on("connection", () => setStatus("connected"));
    ros.on("error", (err) => {
      setStatus("error");
      setErrorMessage(err?.toString?.() ?? "Unknown rosbridge connection error");
    });
    ros.on("close", () => {
      if (explicitDisconnectRef.current) {
        setStatus("idle");
        return;
      }
      // Unexpected close (e.g. proxy idle timeout) — quietly retry rather
      // than dropping the user back to the landing page.
      setStatus("connecting");
      reconnectTimerRef.current = setTimeout(() => {
        if (!explicitDisconnectRef.current && urlRef.current) {
          connect(urlRef.current);
        }
      }, RECONNECT_DELAY_MS);
    });
  }, []);

  const disconnect = useCallback(() => {
    explicitDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    rosRef.current?.close();
    rosRef.current = null;
    setStatus("idle");
  }, []);

  return { status, errorMessage, connect, disconnect, ros: rosRef.current };
}