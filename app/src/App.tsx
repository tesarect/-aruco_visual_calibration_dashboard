import { FormEvent, useEffect, useState } from "react";
import { useRosbridge } from "@/useRosbridge";
import { RosbridgeStatusLed } from "@/components/RosbridgeStatusLed";
import { RobotViewer } from "@/components/RobotViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "rosbridge-url";

interface RosjectConfig {
  rosbridgeAddress: string;
}

function useRosjectRosbridgeAddress(setUrl: (url: string) => void) {
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
  }, [setUrl]);
}

function LandingPage({
  url,
  setUrl,
  connecting,
  errorMessage,
  onSubmit,
}: {
  url: string;
  setUrl: (url: string) => void;
  connecting: boolean;
  errorMessage: string | null;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <main className="mx-auto mt-16 max-w-md font-sans">
      <h1 className="text-2xl font-semibold">Visual Calibration Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Enter the rosbridge WebSocket URL (from the rosject's <code>rosbridge_address</code>).
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <Input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://<host>:9090"
          disabled={connecting}
          className="flex-1"
        />
        <Button type="submit" disabled={connecting}>
          {connecting ? "Connecting..." : "Connect"}
        </Button>
      </form>

      {errorMessage && <p className="mt-3 text-destructive">{errorMessage}</p>}
    </main>
  );
}

function DashboardHeader({
  status,
  onDisconnect,
}: {
  status: ReturnType<typeof useRosbridge>["status"];
  onDisconnect: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <span className="font-semibold">Visual Calibration Dashboard</span>
      <div className="flex items-center gap-4">
        <RosbridgeStatusLed status={status} />
        <Button variant="outline" size="sm" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    </header>
  );
}

export default function App() {
  const [url, setUrl] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "ws://localhost:9090"
  );
  const { status, errorMessage, connect, disconnect, ros } = useRosbridge();

  useRosjectRosbridgeAddress(setUrl);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem(STORAGE_KEY, url);
    connect(url);
  };

  if (status !== "connected") {
    return (
      <LandingPage
        url={url}
        setUrl={setUrl}
        connecting={status === "connecting"}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader status={status} onDisconnect={disconnect} />
      <main className="flex-1">
        <RobotViewer ros={ros} />
      </main>
    </div>
  );
}