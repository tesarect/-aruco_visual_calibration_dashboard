import { FormEvent, useEffect, useState } from "react";
import { useRosbridge } from "@/useRosbridge";
import { RosbridgeStatusLed } from "@/components/RosbridgeStatusLed";
import { RobotViewer } from "@/components/RobotViewer";
import { MarkersPanel, useMarkerVisibility } from "@/components/MarkersPanel";
import { CalibrationPanel } from "@/components/CalibrationPanel";
import { PresetPositionsPanel } from "@/components/PresetPositionsPanel";
import { LogsPanel, LOG_NODES } from "@/components/LogsPanel";
import { LogsFeed } from "@/components/LogsFeed";
import { CameraFeed } from "@/components/CameraFeed";
import { useRosout } from "@/useRosout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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
    <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
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

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2">
      <Separator className="shrink" />
      <span className="shrink-0 text-xs font-medium uppercase text-muted-foreground">
        {children}
      </span>
      <Separator className="shrink" />
    </div>
  );
}

function LeftPanel({
  ros,
  markerVisibility,
  setMarkerVisibility,
  enabledLogNodes,
  setEnabledLogNodes,
}: {
  ros: ReturnType<typeof useRosbridge>["ros"];
  markerVisibility: ReturnType<typeof useMarkerVisibility>[0];
  setMarkerVisibility: ReturnType<typeof useMarkerVisibility>[1];
  enabledLogNodes: Set<string>;
  setEnabledLogNodes: (nodes: Set<string>) => void;
}) {
  return (
    <aside className="flex w-96 shrink-0 flex-col gap-6 overflow-y-auto border-r p-6">
      <div className="flex flex-col gap-3">
        <SectionLabel>Calibration</SectionLabel>
        <CalibrationPanel ros={ros} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Prefixed Positions</SectionLabel>
        <PresetPositionsPanel />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Visual Markers</SectionLabel>
        <MarkersPanel value={markerVisibility} onChange={setMarkerVisibility} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Logs</SectionLabel>
        <LogsPanel enabledNodes={enabledLogNodes} onChange={setEnabledLogNodes} />
      </div>
    </aside>
  );
}

export default function App() {
  const [url, setUrl] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "ws://localhost:9090"
  );
  const { status, errorMessage, connect, disconnect, ros } = useRosbridge();
  const [markerVisibility, setMarkerVisibility] = useMarkerVisibility();
  const [enabledLogNodes, setEnabledLogNodes] = useState<Set<string>>(
    () => new Set(LOG_NODES.map((node) => node.id))
  );
  const logLines = useRosout(ros, enabledLogNodes);

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
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          ros={ros}
          markerVisibility={markerVisibility}
          setMarkerVisibility={setMarkerVisibility}
          enabledLogNodes={enabledLogNodes}
          setEnabledLogNodes={setEnabledLogNodes}
        />
        <div className="relative flex-1 overflow-hidden">
          <main className="absolute inset-0">
            <RobotViewer ros={ros} markerVisibility={markerVisibility} />
          </main>

          <div className="pointer-events-none absolute right-4 top-4 z-10">
            <div className="pointer-events-auto shadow-xl">
              <CameraFeed ros={ros} />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 z-10">
            <LogsFeed lines={logLines} />
          </div>
        </div>
      </div>
    </div>
  );
}