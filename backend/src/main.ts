import { join } from "node:path";
import { WSSubscribedMessageSchema, WSSubscribeMessageSchema } from "@convconv/shared/schemas/websocket";
import { config } from "./config";
import { ApiRouter } from "./routes/api";
import { FFmpegService } from "./services/ffmpeg";
import { JobService } from "./services/jobs";
import { StorageService } from "./services/storage";
import { WebSocketManager } from "./utils/websocket";

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
    if (url.pathname === "/api/health" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

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

    // Serve static files from public directory
    if (request.method === "GET") {
      const publicPath = join(import.meta.dir, "../public");
      let filePath = url.pathname;

      // Serve index.html for root path
      if (filePath === "/" || filePath === "") {
        filePath = "/index.html";
      }

      const file = Bun.file(join(publicPath, filePath));

      // Check if file exists
      if (await file.exists()) {
        // Set content type based on file extension
        const ext = filePath.split(".").pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          html: "text/html",
          css: "text/css",
          js: "application/javascript",
          json: "application/json",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          svg: "image/svg+xml",
          ico: "image/x-icon",
        };

        const contentType = contentTypes[ext ?? ""] || "application/octet-stream";

        return new Response(file, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": ext === "html" ? "no-cache" : "public, max-age=31536000",
          },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(_ws) {
      console.log("WebSocket connected");
    },

    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());

        // Validate incoming message
        const result = WSSubscribeMessageSchema.safeParse(data);

        if (result.success && result.data.type === "subscribe") {
          wsManager.subscribe(ws, result.data.jobId);

          // Create and validate response
          const response = WSSubscribedMessageSchema.parse({
            type: "subscribed",
            jobId: result.data.jobId,
          });

          ws.send(JSON.stringify(response));
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
