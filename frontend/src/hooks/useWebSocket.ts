import { WSMessageSchema } from "@convconv/shared/schemas/websocket";
import type { FFmpegProgress } from "@convconv/shared/types/ffmpeg";
import { useEffect, useRef } from "react";
import { wsService } from "../services/websocket";

export const useWebSocket = (
  jobId: string | null,
  onProgress: (progress: FFmpegProgress) => void,
  onComplete: (data: { downloadUrl: string }) => void,
  onError: (error: { error: string }) => void,
) => {
  const callbackRef = useRef<((message: unknown) => void) | undefined>(undefined);

  useEffect(() => {
    if (!jobId) return;

    callbackRef.current = (rawMessage: unknown) => {
      // Parse and validate the message with Zod
      const result = WSMessageSchema.safeParse(rawMessage);

      if (!result.success) {
        console.error("Invalid WebSocket message:", result.error);
        return;
      }

      const message = result.data;

      // Type-safe message handling
      switch (message.type) {
        case "progress":
          onProgress(message.data);
          break;
        case "complete":
          onComplete(message.data);
          break;
        case "error":
          onError(message.data);
          break;
      }
    };

    wsService.subscribeToJob(jobId, callbackRef.current);

    return () => {
      if (callbackRef.current) {
        wsService.unsubscribeFromJob(jobId, callbackRef.current);
      }
    };
  }, [jobId, onProgress, onComplete, onError]);
};
