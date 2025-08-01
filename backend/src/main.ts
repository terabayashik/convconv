import { join } from "node:path";
import { WSSubscribedMessageSchema, WSSubscribeMessageSchema } from "@convconv/shared/schemas/websocket";
import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { createBunWebSocket, serveStatic } from "hono/bun";
import { cors } from "hono/cors";
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

// Create Hono app
const app = new Hono();

// Setup CORS for API routes
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.use(
  "/ws",
  cors({
    origin: "*",
    allowMethods: ["GET"],
    allowHeaders: ["Content-Type"],
  }),
);

// API routes
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/api/upload", api.handleUpload);

app.post("/api/convert", api.handleConvert);

app.get("/api/jobs/:jobId", api.handleJobStatus);

app.get("/api/download/:jobId", api.handleDownload);

app.post("/api/preview", api.handlePreview);

// Direct conversion endpoint (file + options in one request)
app.post("/api/convert-direct", api.handleConvertDirect);

// Test source generation endpoints
app.post("/api/test-source", api.handleTestSource);
app.get("/api/test-source/presets", api.handleTestSourcePresets);

// WebSocket route
const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

app.get(
  "/ws",
  upgradeWebSocket((_c) => {
    return {
      onOpen(_event, _ws) {
        console.log("WebSocket connected");
      },
      onMessage(event, ws) {
        try {
          const data = JSON.parse(event.data.toString());

          // Validate incoming message
          const result = WSSubscribeMessageSchema.safeParse(data);

          if (result.success && result.data.type === "subscribe" && ws.raw) {
            wsManager.subscribe(ws.raw, result.data.jobId);

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
      onClose(_event, ws) {
        if (ws.raw) {
          wsManager.removeClient(ws.raw);
        }
        console.log("WebSocket disconnected");
      },
    };
  }),
);

// Serve static files
app.use("/assets/*", serveStatic({ root: "./public" }));
app.use("/test-patterns/*", serveStatic({ root: "./public" }));
app.use("/*.svg", serveStatic({ root: "./public" }));
app.use("/*.ico", serveStatic({ root: "./public" }));

// Serve index.html for root and all non-API routes
app.get("/", async (c) => {
  try {
    const file = Bun.file("./public/index.html");
    const content = await file.text();
    return c.html(content);
  } catch (error) {
    console.error("Error serving index.html:", error);
    return c.text("File not found", 404);
  }
});

// SPA fallback
app.get("*", async (c) => {
  try {
    const file = Bun.file("./public/index.html");
    const content = await file.text();
    return c.html(content);
  } catch (error) {
    console.error("Error serving index.html:", error);
    return c.text("File not found", 404);
  }
});

// Start server
const server = Bun.serve({
  port: config.server.port,
  hostname: config.server.host,
  fetch: app.fetch,
  websocket,
});

console.log(`Server running at http://${config.server.host}:${config.server.port}`);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  storage.stopCleanup();
  server.stop();
  process.exit(0);
});
