import { FormEvent, useState } from "react";
import { useRosbridge } from "./useRosbridge";

const STORAGE_KEY = "rosbridge-url";

export default function App() {
  const [url, setUrl] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "ws://localhost:9090"
  );
  const { status, errorMessage, connect, disconnect } = useRosbridge();

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