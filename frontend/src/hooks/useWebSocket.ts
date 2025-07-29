import { useEffect, useRef } from "react";
import { wsService } from "../services/websocket";

export const useWebSocket = (
  jobId: string | null,
  onProgress: (progress: any) => void,
  onComplete: (data: any) => void,
  onError: (error: any) => void
) => {
  const callbackRef = useRef<(message: any) => void>();

  useEffect(() => {
    if (!jobId) return;

    callbackRef.current = (message: any) => {
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