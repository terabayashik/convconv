import { config } from "./config";
import { StorageService } from "./services/storage";
import { JobService } from "./services/jobs";
import { FFmpegService } from "./services/ffmpeg";
import { WebSocketManager } from "./utils/websocket";
import { ApiRouter } from "./routes/api";

// Initialize services
const storage = new StorageService();
const jobs = new JobService();
const ffmpeg = new FFmpegService(config.ffmpeg.binaryPath);
const wsManager = new WebSocketManager();
const api = new ApiRouter(storage, jobs, ffmpeg, wsManager);

// Initialize storage (creates directories and starts cleanup)
await storage.initialize();

// Create server
const server = Bun.serve({
  port: config.server.port,
  hostname: config.server.host,
  
  async fetch(request, server) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(request);
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 400 });
      }
      return undefined;
    }
    
    // Handle API routes
    if (url.pathname === "/api/upload" && request.method === "POST") {
      return api.handleUpload(request);
    }
    
    if (url.pathname === "/api/convert" && request.method === "POST") {
      return api.handleConvert(request);
    }
    
    if (url.pathname.startsWith("/api/jobs/") && request.method === "GET") {
      return api.handleJobStatus(request);
    }
    
    if (url.pathname.startsWith("/api/download/") && request.method === "GET") {
      return api.handleDownload(request);
    }
    
    // Handle CORS for frontend development
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    
    return new Response("Not found", { status: 404 });
  },
  
  websocket: {
    open(ws) {
      console.log("WebSocket connected");
    },
    
    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "subscribe" && data.jobId) {
          wsManager.subscribe(ws, data.jobId);
          ws.send(JSON.stringify({
            type: "subscribed",
            jobId: data.jobId,
          }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    },
    
    close(ws) {
      wsManager.removeClient(ws);
      console.log("WebSocket disconnected");
    },
  },
});

console.log(`Server running at http://${config.server.host}:${config.server.port}`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  storage.stopCleanup();
  server.stop();
  process.exit(0);
});