import { FormEvent, useEffect, useState } from "react";
import { useRosbridge } from "./useRosbridge";

const STORAGE_KEY = "rosbridge-url";

interface RosjectConfig {
  rosbridgeAddress: string;
}

export default function App() {
  const [url, setUrl] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "ws://localhost:9090"
  );
  const { status, errorMessage, connect, disconnect } = useRosbridge();

  useEffect(() => {
    // Relative, not root-absolute — the page is served under the
    // rosject's /<SLOT_PREFIX>/webpage/ proxy prefix, and a root-absolute
    // fetch resolves against the domain root instead, 404ing (same class
    // of bug as vite.config.ts's base:"./" fix — see README.md).
    fetch("./rosject-config.json")
      .then((res) => (res.ok ? (res.json() as Promise<RosjectConfig>) : null))
      .then((config) => {
        // The rosject's instance/SLOT_PREFIX changes every session, so a
        // freshly-fetched rosbridge_address is more trustworthy than
        // whatever URL was saved to localStorage last session.
        if (config?.rosbridgeAddress) {
          setUrl(config.rosbridgeAddress);
        }
      })
      .catch(() => {
        // rosject-config.json is optional (e.g. running outside a
        // rosject) — fall back silently to the existing default.
      });
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem(STORAGE_KEY, url);
    connect(url);
  };

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Visual Calibration Dashboard</h1>
      <p>Enter the rosbridge WebSocket URL (from the rosject's <code>rosbridge_address</code>).</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://<host>:9090"
          style={{ flex: 1, padding: "0.5rem" }}
          disabled={status === "connecting"}
        />
        <button type="submit" disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting..." : "Connect"}
        </button>
      </form>

      <div style={{ marginTop: "1rem" }}>
        <strong>Status:</strong> {status}
        {status === "connected" && (
          <button style={{ marginLeft: "1rem" }} onClick={disconnect}>
            Disconnect
          </button>
        )}
        {errorMessage && (
          <p style={{ color: "crimson" }}>{errorMessage}</p>
        )}
      </div>

      {status === "connected" && (
        <p style={{ marginTop: "2rem", color: "#666" }}>
          Connected. Robot model rendering comes next once this is confirmed working.
        </p>
      )}
    </main>
  );
}