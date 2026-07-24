import { FormEvent, useEffect, useState } from "react";
import { useRosbridge } from "@/useRosbridge";
import { RosbridgeStatusLed } from "@/components/RosbridgeStatusLed";
import { RobotViewer, useUrdfRobot } from "@/components/RobotViewer";
import { MarkersPanel, useMarkerVisibility } from "@/components/MarkersPanel";
import { CalibrationPanel } from "@/components/CalibrationPanel";
import { PresetPositionsPanel } from "@/components/PresetPositionsPanel";
import { ControlPanel } from "@/components/ControlPanel";
import { LogsPanel, LOG_NODES } from "@/components/LogsPanel";
import { LogsFeed } from "@/components/LogsFeed";
import { CameraFeed } from "@/components/CameraFeed";
import { NodeHealthCard } from "@/components/NodeHealthCard";
import { DevSpaceDrawer } from "@/components/DevSpaceDrawer";
import { useRosout } from "@/useRosout";
import { useTrajectoryState } from "@/useTrajectoryState";
import { useRobotEnv } from "@/useRobotEnv";
import { useNodeHealth } from "@/useNodeHealth";
import { useCalibrationAction } from "@/useCalibrationAction";
import { useGripperPose } from "@/useGripperPose";
import { useGripperTrail } from "@/useGripperTrail";
import type { RobotEnv } from "@/markerFrames";
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

function PlanningFailureBanner({
  failure,
  onDismiss,
}: {
  failure: { context: string; message: string } | null;
  onDismiss: () => void;
}) {
  if (!failure) return null;

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 shadow-xl">
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase text-destructive/80">
          Planning failure — {failure.context}
        </span>
        <span className="text-sm text-destructive">{failure.message}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
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
  env,
  robot,
  calibration,
  markerVisibility,
  setMarkerVisibility,
  enabledLogNodes,
  setEnabledLogNodes,
  logsVisible,
  setLogsVisible,
  trailEnabled,
  setTrailEnabled,
  armTransparent,
  setArmTransparent,
}: {
  ros: ReturnType<typeof useRosbridge>["ros"];
  env: RobotEnv | null;
  robot: ReturnType<typeof useUrdfRobot>["robot"];
  calibration: ReturnType<typeof useCalibrationAction>;
  markerVisibility: ReturnType<typeof useMarkerVisibility>[0];
  setMarkerVisibility: ReturnType<typeof useMarkerVisibility>[1];
  enabledLogNodes: Set<string>;
  setEnabledLogNodes: (nodes: Set<string>) => void;
  logsVisible: boolean;
  setLogsVisible: (visible: boolean) => void;
  trailEnabled: boolean;
  setTrailEnabled: (enabled: boolean) => void;
  armTransparent: boolean;
  setArmTransparent: (transparent: boolean) => void;
}) {
  return (
    <aside className="flex w-96 shrink-0 flex-col gap-6 overflow-y-auto border-r p-6">
      <div className="flex flex-col gap-3">
        <SectionLabel>Calibration</SectionLabel>
        <CalibrationPanel ros={ros} calibration={calibration} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Prefixed Positions</SectionLabel>
        <PresetPositionsPanel ros={ros} />
      </div>

      <div className="flex flex-col gap-3">
        <Separator />
        <div className="flex flex-col gap-2">
          <ControlPanel ros={ros} env={env} robot={robot} />
          <MarkersPanel env={env} value={markerVisibility} onChange={setMarkerVisibility} />
          <DevSpaceDrawer
            calibration={calibration}
            trailEnabled={trailEnabled}
            onTrailEnabledChange={setTrailEnabled}
            armTransparent={armTransparent}
            onArmTransparentChange={setArmTransparent}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Logs</SectionLabel>
        <LogsPanel
          enabledNodes={enabledLogNodes}
          onChange={setEnabledLogNodes}
          logsVisible={logsVisible}
          onLogsVisibleChange={setLogsVisible}
        />
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
  const [logsVisible, setLogsVisible] = useState(false);
  const logLines = useRosout(ros, enabledLogNodes);
  const { latestFailure, dismissFailure } = useTrajectoryState(ros);
  const env = useRobotEnv(ros);
  const { robot, error: robotError } = useUrdfRobot(env);
  const nodeHealth = useNodeHealth(ros, env);
  const calibration = useCalibrationAction(ros);
  const [trailEnabled, setTrailEnabled] = useState(false);
  const [armTransparent, setArmTransparent] = useState(false);
  // Independent of ControlPanel's own useGripperPose call (that one is
  // gated to its Control drawer's open state) — the trail has its own
  // lifecycle, gated to the Dev Space drawer's toggle switch instead, so it
  // keeps running/growing even while the Control drawer is closed.
  const trailPose = useGripperPose(robot, env, trailEnabled);
  const trailPoints = useGripperTrail(trailPose, trailEnabled);

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
          env={env}
          robot={robot}
          calibration={calibration}
          markerVisibility={markerVisibility}
          setMarkerVisibility={setMarkerVisibility}
          enabledLogNodes={enabledLogNodes}
          setEnabledLogNodes={setEnabledLogNodes}
          logsVisible={logsVisible}
          setLogsVisible={setLogsVisible}
          trailEnabled={trailEnabled}
          setTrailEnabled={setTrailEnabled}
          armTransparent={armTransparent}
          setArmTransparent={setArmTransparent}
        />
        <div className="relative flex-1 overflow-hidden">
          <main className="absolute inset-0">
            <RobotViewer
              ros={ros}
              env={env}
              robot={robot}
              error={robotError}
              markerVisibility={markerVisibility}
              trailPoints={trailPoints}
              armTransparent={armTransparent}
            />
          </main>

          {latestFailure && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
              <PlanningFailureBanner failure={latestFailure} onDismiss={dismissFailure} />
            </div>
          )}

          <div className="pointer-events-none absolute right-4 top-4 z-10">
            <div className="pointer-events-auto shadow-xl">
              <CameraFeed ros={ros} env={env} />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 z-10">
            <div className="pointer-events-auto shadow-xl">
              <NodeHealthCard
                robotStatePublisher={nodeHealth.robotStatePublisher}
                trajectoryController={nodeHealth.trajectoryController}
                checking={nodeHealth.checking}
                onRefresh={nodeHealth.refresh}
              />
            </div>
          </div>

          {logsVisible && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 right-4 z-10">
              <LogsFeed lines={logLines} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}