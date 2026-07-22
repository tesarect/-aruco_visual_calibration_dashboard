import { useEffect, useRef, useState } from "react";
import * as ROSLIB from "roslib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { RobotEnv } from "@/markerFrames";

interface CameraFeedProps {
  ros: ROSLIB.Ros | null;
  env: RobotEnv | null;
}

// Sim's wrist-mounted Gazebo camera plugin auto-publishes an image_transport
// /compressed republish alongside the raw topic (confirmed live, see
// resources/info/sim_information_observations.md) — sensor_msgs/CompressedImage,
// decoded directly as a data: URL below.
const SIM_IMAGE_TOPIC = "/wrist_rgbd_depth_sensor/image_raw/compressed";

// Real's D415 (fed over Zenoh, see CLAUDE.md's Zenoh section) publishes
// plain sensor_msgs/Image only — confirmed no /compressed republisher exists
// (`ros2 topic list` showed only /D415/color/image_raw, no /compressed
// variant) — so this needs the raw-Image decode path (rgb8/bgr8 byte buffer
// -> canvas), not the compressed data: URL path sim's raw feed uses.
const REAL_RAW_IMAGE_TOPIC = "/D415/color/image_raw";

// aruco_detector_node's overlay_image_topic is the same name on both envs,
// but — unlike the depth sensor's own topics — it's a manually-created
// image_transport publisher in aruco_detector_node.cpp, not a Gazebo camera
// plugin's auto-generated transport, so it never gets a /compressed
// republish on EITHER env (confirmed via ros2 topic list on both) — always
// needs the raw-Image decode path regardless of sim/real.
const OVERLAY_IMAGE_TOPIC = "/aruco_perception/overlay_image";

interface CompressedImageMessage {
  format: string;
  data: string;
}

interface RawImageMessage {
  width: number;
  height: number;
  encoding: string;
  is_bigendian: number;
  step: number;
  data: string;
}

function useCompressedImage(ros: ROSLIB.Ros | null, enabled: boolean) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const formatRef = useRef("jpeg");

  useEffect(() => {
    setDataUrl(null);
    if (!ros || !enabled) return;

    const topic = new ROSLIB.Topic({
      ros,
      name: SIM_IMAGE_TOPIC,
      messageType: "sensor_msgs/CompressedImage",
    });

    const handleMessage = (message: CompressedImageMessage) => {
      formatRef.current = message.format || "jpeg";
      setDataUrl(`data:image/${formatRef.current};base64,${message.data}`);
    };

    topic.subscribe(handleMessage);
    return () => topic.unsubscribe(handleMessage);
  }, [ros, enabled]);

  return dataUrl;
}

// YUV -> RGB (BT.601, standard for 8-bit "studio range" YUV like YUY2) —
// only needed for the yuv422_yuy2 path below, rgb8/bgr8 need no conversion.
function yuvToRgb(y: number, u: number, v: number): [number, number, number] {
  const c = y - 16;
  const d = u - 128;
  const e = v - 128;
  const r = (298 * c + 409 * e + 128) >> 8;
  const g = (298 * c - 100 * d - 208 * e + 128) >> 8;
  const b = (298 * c + 516 * d + 128) >> 8;
  return [
    Math.min(255, Math.max(0, r)),
    Math.min(255, Math.max(0, g)),
    Math.min(255, Math.max(0, b)),
  ];
}

// Decodes a raw sensor_msgs/Image into a canvas-rendered data: URL — base64
// in the wire message is the raw pixel byte buffer here, not a JPEG/PNG blob
// like CompressedImage's `data`. Supports rgb8/bgr8 (confirmed working for
// sim's overlay) and yuv422_yuy2 (real D415 driver's actual wire encoding
// for /D415/color/image_raw, confirmed live 2026-07-20 — NOT rgb8/bgr8).
function useRawImage(ros: ROSLIB.Ros | null, topicName: string | null) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setDataUrl(null);
    if (!ros || !topicName) {
      console.log("[camera-feed] raw image subscription skipped", { hasRos: !!ros, topicName });
      return;
    }

    console.log("[camera-feed] subscribing to raw image topic", topicName);
    const topic = new ROSLIB.Topic({
      ros,
      name: topicName,
      messageType: "sensor_msgs/Image",
    });

    const handleMessage = (message: RawImageMessage) => {
      console.log("[camera-feed] raw image message", topicName, {
        width: message.width,
        height: message.height,
        encoding: message.encoding,
        step: message.step,
        dataLength: message.data?.length,
      });
      const { width, height, encoding, step } = message;
      if (!width || !height) {
        console.warn("[camera-feed] raw image message missing width/height", topicName, message);
        return;
      }
      if (encoding !== "rgb8" && encoding !== "bgr8" && encoding !== "yuv422_yuy2") {
        console.warn("[camera-feed] unsupported raw image encoding", topicName, encoding);
        return;
      }

      const binary = atob(message.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // `step` is the actual source row stride in bytes — can be larger
      // than width * bytesPerPixel (row padding/alignment), so each row
      // must be read starting at row * step, NOT assumed to be packed
      // tightly. Reading by flat pixel index instead (ignoring step) is
      // what caused the "only top strip visible" bug: any padding bytes
      // got consumed as if they were pixel data, shifting every
      // subsequent row's read position out from under it.
      const imageData = ctx.createImageData(width, height);
      if (encoding === "yuv422_yuy2") {
        // 4 bytes per 2 horizontally-adjacent pixels: Y0 U Y1 V, sharing
        // one U/V chroma pair (4:2:2 subsampling).
        for (let row = 0; row < height; row++) {
          const rowStart = row * step;
          const outRowStart = row * width * 4;
          for (let col = 0, i = 0, p = 0; col < width; col += 2, i += 4, p += 8) {
            const base = rowStart + i;
            const [y0, u, y1, v] = [bytes[base], bytes[base + 1], bytes[base + 2], bytes[base + 3]];
            const [r0, g0, b0] = yuvToRgb(y0, u, v);
            const [r1, g1, b1] = yuvToRgb(y1, u, v);
            const outBase = outRowStart + p;
            imageData.data[outBase] = r0;
            imageData.data[outBase + 1] = g0;
            imageData.data[outBase + 2] = b0;
            imageData.data[outBase + 3] = 255;
            imageData.data[outBase + 4] = r1;
            imageData.data[outBase + 5] = g1;
            imageData.data[outBase + 6] = b1;
            imageData.data[outBase + 7] = 255;
          }
        }
      } else {
        const isBgr = encoding === "bgr8";
        for (let row = 0; row < height; row++) {
          const rowStart = row * step;
          const outRowStart = row * width * 4;
          for (let col = 0, i = 0, p = 0; col < width; col++, i += 3, p += 4) {
            const base = rowStart + i;
            const outBase = outRowStart + p;
            imageData.data[outBase] = bytes[isBgr ? base + 2 : base];
            imageData.data[outBase + 1] = bytes[base + 1];
            imageData.data[outBase + 2] = bytes[isBgr ? base : base + 2];
            imageData.data[outBase + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setDataUrl(canvas.toDataURL("image/png"));
    };

    topic.subscribe(handleMessage);
    return () => topic.unsubscribe(handleMessage);
  }, [ros, topicName]);

  return dataUrl;
}

export function CameraFeed({ ros, env }: CameraFeedProps) {
  const [overlayed, setOverlayed] = useState(false);
  const isSim = env === "sim";

  // Sim's own raw feed is the only case with a real /compressed topic —
  // everything else (overlay on either env, real's raw feed) is plain
  // sensor_msgs/Image and goes through the raw-Image canvas decode instead.
  const simDataUrl = useCompressedImage(ros, isSim && !overlayed);
  const rawTopicName = overlayed ? OVERLAY_IMAGE_TOPIC : !isSim && env ? REAL_RAW_IMAGE_TOPIC : null;
  const rawDataUrl = useRawImage(ros, rawTopicName);
  const dataUrl = isSim && !overlayed ? simDataUrl : rawDataUrl;

  return (
    // CSS `resize` always grips the bottom-right corner of the element it's
    // applied to, non-configurable by spec. This card sits in the screen's
    // own bottom-right corner (App.tsx), making that grip unreachable.
    // Standard fix: apply scaleX(-1) directly to the resizable Card itself
    // (flips the element AND its native resize grip to the bottom-left),
    // then apply a counter scaleX(-1) to an inner wrapper holding all the
    // visible content, so the content renders normally while only the grip
    // stays flipped.
    <Card className="flex h-48 w-64 resize overflow-auto [transform:scaleX(-1)]">
      <div className="flex flex-1 flex-col [transform:scaleX(-1)]">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Camera Feed</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="overlay-switch" className="text-xs text-muted-foreground">
              Overlayed
            </Label>
            <Switch id="overlay-switch" checked={overlayed} onCheckedChange={setOverlayed} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center overflow-hidden p-0">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Wrist camera feed"
              className="h-full w-full object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for image…</p>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
