import { FormEvent, useEffect, useState } from "react";
import { useRosbridge } from "@/useRosbridge";
import { RosbridgeStatusLed } from "@/components/RosbridgeStatusLed";
import { RobotViewer } from "@/components/RobotViewer";
import { MarkersPanel, useMarkerVisibility } from "@/components/MarkersPanel";
import { CalibrationPanel } from "@/components/CalibrationPanel";
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
  markersOpen,
  onToggleMarkers,
  calibrationOpen,
  onToggleCalibration,
}: {
  status: ReturnType<typeof useRosbridge>["status"];
  onDisconnect: () => void;
  markersOpen: boolean;
  onToggleMarkers: () => void;
  calibrationOpen: boolean;
  onToggleCalibration: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="font-semibold">Visual Calibration Dashboard</span>
        <nav className="flex items-center gap-1">
          <Button
            variant={markersOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleMarkers}
          >
            Markers
          </Button>
          <Button
            variant={calibrationOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleCalibration}
          >
            Calibration
          </Button>
        </nav>
      </div>
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
  const [markerVisibility, setMarkerVisibility] = useMarkerVisibility();
  const [markersOpen, setMarkersOpen] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);

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
      <DashboardHeader
        status={status}
        onDisconnect={disconnect}
        markersOpen={markersOpen}
        onToggleMarkers={() => setMarkersOpen((open) => !open)}
        calibrationOpen={calibrationOpen}
        onToggleCalibration={() => setCalibrationOpen((open) => !open)}
      />
      <div className="relative flex-1 overflow-hidden">
        <main className="absolute inset-0">
          <RobotViewer ros={ros} markerVisibility={markerVisibility} />
        </main>

        {(markersOpen || calibrationOpen) && (
          <div className="pointer-events-none absolute inset-y-4 left-4 z-10 flex flex-col gap-4 overflow-y-auto">
            {markersOpen && (
              <div className="pointer-events-auto shadow-xl">
                <MarkersPanel value={markerVisibility} onChange={setMarkerVisibility} />
              </div>
            )}
            {calibrationOpen && (
              <div className="pointer-events-auto shadow-xl">
                <CalibrationPanel ros={ros} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}