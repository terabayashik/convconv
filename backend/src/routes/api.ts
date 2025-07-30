import { ConvertRequestSchema } from "@convconv/shared/schemas/api";
import type { ApiResponse, ConvertResponse } from "@convconv/shared/types/api";
import type { FFmpegService } from "../services/ffmpeg";
import type { JobService } from "../services/jobs";
import type { StorageService } from "../services/storage";
import type { WebSocketManager } from "../utils/websocket";

export class ApiRouter {
  constructor(
    private storage: StorageService,
    private jobs: JobService,
    private ffmpeg: FFmpegService,
    private wsManager: WebSocketManager,
  ) {}

  handleUpload = async (request: Request): Promise<Response> => {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return Response.json(
          {
            success: false,
            error: "No file provided",
          } as ApiResponse<never>,
          {
            status: 400,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      const filePath = await this.storage.saveUploadedFile(file);

      return Response.json(
        {
          success: true,
          data: { filePath },
        } as ApiResponse<{ filePath: string }>,
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      console.error("Upload error:", error);
      return Response.json(
        {
          success: false,
          error: "Upload failed",
        } as ApiResponse<never>,
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  };

  handleConvert = async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const convertRequest = ConvertRequestSchema.parse(body);

      // Assume file is a path string for server-side processing
      if (typeof convertRequest.file !== "string") {
        return Response.json(
          {
            success: false,
            error: "Invalid file reference",
          } as ApiResponse<never>,
          { status: 400 },
        );
      }

      const outputPath = this.storage.getOutputPath(convertRequest.file, convertRequest.outputFormat);

      const job = this.jobs.createJob(convertRequest.file, outputPath);

      // Start conversion in background
      this.processConversion(job.jobId, convertRequest.options);

      return Response.json(
        {
          success: true,
          data: {
            jobId: job.jobId,
            status: job.status,
          },
        } as ApiResponse<ConvertResponse>,
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      console.error("Convert error:", error);
      return Response.json(
        {
          success: false,
          error: "Conversion request failed",
        } as ApiResponse<never>,
        { status: 500 },
      );
    }
  };

  handleJobStatus = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const jobId = url.pathname.split("/").pop();

    if (!jobId) {
      return Response.json(
        {
          success: false,
          error: "Job ID required",
        } as ApiResponse<never>,
        { status: 400 },
      );
    }

    const job = this.jobs.getJob(jobId);
    if (!job) {
      return Response.json(
        {
          success: false,
          error: "Job not found",
        } as ApiResponse<never>,
        { status: 404 },
      );
    }

    return Response.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        downloadUrl: job.downloadUrl,
      },
    } as ApiResponse<ConvertResponse>);
  };

  handleDownload = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const jobId = url.pathname.split("/").pop();

    if (!jobId) {
      return new Response("Job ID required", { status: 400 });
    }

    const job = this.jobs.getJob(jobId);
    if (!job || job.status !== "completed") {
      return new Response("File not ready", { status: 404 });
    }

    const file = Bun.file(job.outputPath);
    return new Response(file, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  };

  handlePreview = async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const convertRequest = ConvertRequestSchema.parse(body);

      if (typeof convertRequest.file !== "string") {
        return Response.json(
          {
            success: false,
            error: "Invalid file reference",
          },
          {
            status: 400,
            headers: { "Access-Control-Allow-Origin": "*" },
          },
        );
      }

      const outputPath = this.storage.getOutputPath(convertRequest.file, convertRequest.outputFormat);
      const command = this.ffmpeg.buildCommand({
        inputFile: convertRequest.file,
        outputFile: outputPath,
        options: convertRequest.options,
      });

      return Response.json(
        {
          success: true,
          data: { command },
        },
        {
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      );
    } catch (error) {
      console.error("Preview error:", error);
      return Response.json(
        {
          success: false,
          error: "Preview failed",
        },
        {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      );
    }
  };

  private processConversion = async (jobId: string, options?: Record<string, unknown>) => {
    const job = this.jobs.startJob(jobId);
    if (!job) return;

    // Initial progress
    this.wsManager.broadcastProgress(jobId, {
      percent: 0,
      time: "00:00:00",
      bitrate: "0kbps",
      speed: "0x",
    });

    const result = await this.ffmpeg.execute(
      {
        inputFile: job.inputPath,
        outputFile: job.outputPath,
        options,
      },
      (progress) => {
        this.jobs.updateProgress(jobId, progress.percent);
        this.wsManager.broadcastProgress(jobId, progress);
      },
    );

    if (result.success) {
      const downloadUrl = `/api/download/${jobId}`;
      this.jobs.completeJob(jobId, downloadUrl);
      this.wsManager.broadcastComplete(jobId, downloadUrl);
    } else {
      this.jobs.failJob(jobId, result.error || "Unknown error");
      this.wsManager.broadcastError(jobId, result.error || "Unknown error");
    }
  };
}
