import { FFmpegProgress } from "@convconv/shared/types/ffmpeg";

interface WSMessage {
  type: "progress" | "complete" | "error" | "subscribe" | "subscribed";
  jobId: string;
  data?: any;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private shouldReconnect = true;
  private url: string;
  private listeners: Map<string, Set<(message: WSMessage) => void>> = new Map();

  constructor(url = "ws://localhost:3000/ws") {
    this.url = url;
  }

  connect = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("WebSocket connected");
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("WebSocket disconnected");
          if (this.shouldReconnect) {
            setTimeout(() => {
              this.connect();
            }, this.reconnectInterval);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.notifyListeners(message.jobId, message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  disconnect = () => {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  };

  subscribeToJob = (jobId: string, callback: (message: WSMessage) => void) => {
    // Add listener
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(callback);

    // Send subscribe message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "subscribe",
        jobId,
      }));
    }
  };

  unsubscribeFromJob = (jobId: string, callback: (message: WSMessage) => void) => {
    const jobListeners = this.listeners.get(jobId);
    if (jobListeners) {
      jobListeners.delete(callback);
      if (jobListeners.size === 0) {
        this.listeners.delete(jobId);
      }
    }
  };

  private notifyListeners = (jobId: string, message: WSMessage) => {
    const jobListeners = this.listeners.get(jobId);
    if (jobListeners) {
      jobListeners.forEach((callback) => callback(message));
    }
  };
}

export const wsService = new WebSocketService();