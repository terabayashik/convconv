export interface WSMessage {
  type: "progress" | "complete" | "error" | "subscribe";
  jobId: string;
  data?: any;
}

export class WebSocketManager {
  private clients: Map<string, Set<WebSocket>> = new Map(); // jobId -> Set of WebSockets

  subscribe = (ws: WebSocket, jobId: string) => {
    if (!this.clients.has(jobId)) {
      this.clients.set(jobId, new Set());
    }
    this.clients.get(jobId)!.add(ws);
  };

  unsubscribe = (ws: WebSocket, jobId: string) => {
    const jobClients = this.clients.get(jobId);
    if (jobClients) {
      jobClients.delete(ws);
      if (jobClients.size === 0) {
        this.clients.delete(jobId);
      }
    }
  };

  broadcast = (jobId: string, message: Omit<WSMessage, "jobId">) => {
    const jobClients = this.clients.get(jobId);
    if (!jobClients) return;

    const fullMessage: WSMessage = { ...message, jobId };
    const messageStr = JSON.stringify(fullMessage);

    jobClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  };

  removeClient = (ws: WebSocket) => {
    this.clients.forEach((jobClients, jobId) => {
      jobClients.delete(ws);
      if (jobClients.size === 0) {
        this.clients.delete(jobId);
      }
    });
  };
}