import { WSSubscribeMessageSchema } from "@convconv/shared/schemas/websocket";

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private shouldReconnect = true;
  private url: string;
  private listeners: Map<string, Set<(message: unknown) => void>> = new Map();

  constructor(url?: string) {
    // Use relative WebSocket URL in production
    let wsUrl = url;
    if (!wsUrl) {
      // In development, use relative path to leverage Vite proxy
      if (import.meta.env.DEV) {
        wsUrl = "ws://localhost:5173/ws";
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        wsUrl = `${protocol}//${host}/ws`;
      }
    }
    this.url = wsUrl;
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
            const rawMessage = JSON.parse(event.data);
            // Pass raw message to listeners for validation
            if (typeof rawMessage === "object" && rawMessage !== null && "jobId" in rawMessage) {
              this.notifyListeners(rawMessage.jobId, rawMessage);
            }
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

  subscribeToJob = (jobId: string, callback: (message: unknown) => void) => {
    // Add listener
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)?.add(callback);

    // Send subscribe message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Validate message before sending
      const message = WSSubscribeMessageSchema.parse({
        type: "subscribe",
        jobId,
      });

      this.ws.send(JSON.stringify(message));
    }
  };

  unsubscribeFromJob = (jobId: string, callback: (message: unknown) => void) => {
    const jobListeners = this.listeners.get(jobId);
    if (jobListeners) {
      jobListeners.delete(callback);
      if (jobListeners.size === 0) {
        this.listeners.delete(jobId);
      }
    }
  };

  private notifyListeners = (jobId: string, message: unknown) => {
    const jobListeners = this.listeners.get(jobId);
    if (jobListeners) {
      jobListeners.forEach((callback) => callback(message));
    }
  };
}

export const wsService = new WebSocketService();
