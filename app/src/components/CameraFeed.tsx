import { useEffect, useRef, useState } from "react";
import ROSLIB from "roslib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CameraFeedProps {
  ros: ROSLIB.Ros | null;
}

// Gazebo's camera plugin auto-publishes this image_transport republish
// alongside the raw topic (see CLAUDE.md's /wrist_rgbd_depth_sensor/image_raw)
// — no extra node (e.g. web_video_server) needs to run for this to work.
const IMAGE_TOPIC = "/wrist_rgbd_depth_sensor/image_raw/compressed";

interface CompressedImageMessage {
  format: string;
  data: string;
}

function useCompressedImage(ros: ROSLIB.Ros | null) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const formatRef = useRef("jpeg");

  useEffect(() => {
    if (!ros) return;

    const topic = new ROSLIB.Topic({
      ros,
      name: IMAGE_TOPIC,
      messageType: "sensor_msgs/CompressedImage",
    });

    const handleMessage = (message: CompressedImageMessage) => {
      formatRef.current = message.format || "jpeg";
      setDataUrl(`data:image/${formatRef.current};base64,${message.data}`);
    };

    topic.subscribe(handleMessage);
    return () => topic.unsubscribe(handleMessage);
  }, [ros]);

  return dataUrl;
}

export function CameraFeed({ ros }: CameraFeedProps) {
  const dataUrl = useCompressedImage(ros);

  return (
    <Card className="flex h-48 w-64 resize overflow-auto">
      <CardHeader>
        <CardTitle>Camera Feed</CardTitle>
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
    </Card>
  );
}
