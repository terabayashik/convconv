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
          console.log("[WebSocket] Connected to:", this.url);
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error("[WebSocket] Error:", error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log("[WebSocket] Disconnected. Code:", event.code, "Reason:", event.reason);
          if (this.shouldReconnect) {
            console.log(`[WebSocket] Reconnecting in ${this.reconnectInterval}ms...`);
            setTimeout(() => {
              this.connect();
            }, this.reconnectInterval);
          }
        };

        this.ws.onmessage = (event) => {
          console.log("[WebSocket] Raw message received:", event.data);
          try {
            const rawMessage = JSON.parse(event.data);
            console.log("[WebSocket] Parsed message:", rawMessage);
            // Pass raw message to listeners for validation
            if (typeof rawMessage === "object" && rawMessage !== null && "jobId" in rawMessage) {
              console.log(`[WebSocket] Notifying listeners for job ${rawMessage.jobId}`);
              this.notifyListeners(rawMessage.jobId, rawMessage);
            } else {
              console.warn("[WebSocket] Message missing jobId:", rawMessage);
            }
          } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
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

      console.log(`[WebSocket] Subscribing to job ${jobId}`);
      this.ws.send(JSON.stringify(message));
      console.log("[WebSocket] Sent subscribe message:", message);
    } else {
      console.warn(`[WebSocket] Cannot subscribe to job ${jobId} - WebSocket not open. State:`, this.ws?.readyState);
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
      console.log(`[WebSocket] Notifying ${jobListeners.size} listener(s) for job ${jobId}`);
      jobListeners.forEach((callback) => callback(message));
    } else {
      console.warn(`[WebSocket] No listeners found for job ${jobId}`);
    }
  };
}

export const wsService = new WebSocketService();
