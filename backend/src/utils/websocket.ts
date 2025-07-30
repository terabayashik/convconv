import {
  type WSCompleteMessage,
  WSCompleteMessageSchema,
  type WSErrorMessage,
  WSErrorMessageSchema,
  type WSProgressMessage,
  WSProgressMessageSchema,
} from "@convconv/shared/schemas/websocket";
import type { FFmpegProgress } from "@convconv/shared/types/ffmpeg";

// Use a generic type for WebSocket to support both browser WebSocket and Bun's ServerWebSocket
interface WSClient {
  send(data: string): void;
  readyState: number;
}

// WebSocket readyState constants
const WS_OPEN = 1;

export class WebSocketManager {
  private clients: Map<string, Set<WSClient>> = new Map(); // jobId -> Set of WebSockets

  subscribe = (ws: WSClient, jobId: string) => {
    if (!this.clients.has(jobId)) {
      this.clients.set(jobId, new Set());
    }
    this.clients.get(jobId)?.add(ws);
  };

  unsubscribe = (ws: WSClient, jobId: string) => {
    const jobClients = this.clients.get(jobId);
    if (jobClients) {
      jobClients.delete(ws);
      if (jobClients.size === 0) {
        this.clients.delete(jobId);
      }
    }
  };

  broadcastProgress = (jobId: string, progress: FFmpegProgress) => {
    const message: WSProgressMessage = {
      type: "progress",
      jobId,
      data: progress,
    };

    // Validate message with Zod
    const validatedMessage = WSProgressMessageSchema.parse(message);
    console.log(`[WebSocket] Broadcasting progress for job ${jobId}: ${progress.percent}%`);
    this.sendToClients(jobId, validatedMessage);
  };

  broadcastComplete = (jobId: string, downloadUrl: string) => {
    const message: WSCompleteMessage = {
      type: "complete",
      jobId,
      data: { downloadUrl },
    };

    const validatedMessage = WSCompleteMessageSchema.parse(message);
    this.sendToClients(jobId, validatedMessage);
  };

  broadcastError = (jobId: string, error: string) => {
    const message: WSErrorMessage = {
      type: "error",
      jobId,
      data: { error },
    };

    const validatedMessage = WSErrorMessageSchema.parse(message);
    this.sendToClients(jobId, validatedMessage);
  };

  private sendToClients = (jobId: string, message: WSProgressMessage | WSCompleteMessage | WSErrorMessage) => {
    const jobClients = this.clients.get(jobId);
    if (!jobClients) return;

    const messageStr = JSON.stringify(message);

    jobClients.forEach((ws) => {
      if (ws.readyState === WS_OPEN) {
        ws.send(messageStr);
      }
    });
  };

  removeClient = (ws: WSClient) => {
    this.clients.forEach((jobClients, jobId) => {
      jobClients.delete(ws);
      if (jobClients.size === 0) {
        this.clients.delete(jobId);
      }
    });
  };
}
