import { ConvertRequestSchema } from "@convconv/shared/schemas/api";
import {
  ApiErrorResponseSchema,
  ConvertResponseSchema,
  JobStatusResponseSchema,
  PreviewResponseSchema,
  TestSourceBatchResponseSchema,
  TestSourcePresetsResponseSchema,
  TestSourceResponseSchema,
  UploadResponseSchema,
} from "@convconv/shared/schemas/apiResponse";
import { TestSourceRequestSchema } from "@convconv/shared/schemas/testSource";
import type { Context } from "hono";
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

  handleUpload = async (c: Context): Promise<Response> => {
    try {
      const formData = await c.req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        const errorResponse = ApiErrorResponseSchema.parse({
          success: false,
          error: "No file provided",
        });
        return c.json(errorResponse, 400);
      }

      const filePath = await this.storage.saveUploadedFile(file);

      const response = UploadResponseSchema.parse({
        success: true,
        data: { filePath },
      });
      return c.json(response);
    } catch (error) {
      console.error("Upload error:", error);
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Upload failed",
      });
      return c.json(errorResponse, 500);
    }
  };

  handleConvert = async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json();
      const convertRequest = ConvertRequestSchema.parse(body);

      // Assume file is a path string for server-side processing
      if (typeof convertRequest.file !== "string") {
        const errorResponse = ApiErrorResponseSchema.parse({
          success: false,
          error: "Invalid file reference",
        });
        return c.json(errorResponse, 400);
      }

      const outputPath = this.storage.getOutputPath(convertRequest.file, convertRequest.outputFormat);

      const job = this.jobs.createJob(convertRequest.file, outputPath);

      // Start conversion in background
      this.processConversion(job.jobId, convertRequest.options);

      const response = ConvertResponseSchema.parse({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      });
      return c.json(response);
    } catch (error) {
      console.error("Convert error:", error);
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Conversion request failed",
      });
      return c.json(errorResponse, 500);
    }
  };

  handleJobStatus = async (c: Context): Promise<Response> => {
    const jobId = c.req.param("jobId");

    if (!jobId) {
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Job ID required",
      });
      return c.json(errorResponse, 400);
    }

    const job = this.jobs.getJob(jobId);
    if (!job) {
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Job not found",
      });
      return c.json(errorResponse, 404);
    }

    const response = JobStatusResponseSchema.parse({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        downloadUrl: job.downloadUrl,
      },
    });
    return c.json(response);
  };

  handleDownload = async (c: Context): Promise<Response> => {
    const jobId = c.req.param("jobId");

    if (!jobId) {
      return c.text("Job ID required", 400);
    }

    const job = this.jobs.getJob(jobId);
    if (!job || job.status !== "completed") {
      return c.text("File not ready", 404);
    }

    const file = Bun.file(job.outputPath);
    const filename = job.outputPath.split("/").pop() || "download";

    // Set appropriate headers for file download
    c.header("Content-Type", "application/octet-stream");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);

    return c.body(await file.arrayBuffer());
  };

  handleConvertDirect = async (c: Context): Promise<Response> => {
    try {
      const formData = await c.req.formData();
      const file = formData.get("file");
      const outputFormat = formData.get("outputFormat");
      const options = formData.get("options");

      // Validate required fields
      if (!file || !(file instanceof File)) {
        const errorResponse = ApiErrorResponseSchema.parse({
          success: false,
          error: "No file provided",
        });
        return c.json(errorResponse, 400);
      }

      if (!outputFormat || typeof outputFormat !== "string") {
        const errorResponse = ApiErrorResponseSchema.parse({
          success: false,
          error: "Output format required",
        });
        return c.json(errorResponse, 400);
      }

      // Parse options if provided
      let parsedOptions: Record<string, unknown> | undefined;
      if (options && typeof options === "string") {
        try {
          parsedOptions = JSON.parse(options);
        } catch {
          const errorResponse = ApiErrorResponseSchema.parse({
            success: false,
            error: "Invalid options JSON",
          });
          return c.json(errorResponse, 400);
        }
      }

      // Save uploaded file
      const filePath = await this.storage.saveUploadedFile(file);

      // Create conversion job
      const outputPath = this.storage.getOutputPath(filePath, outputFormat);
      const job = this.jobs.createJob(filePath, outputPath);

      // Start conversion in background
      this.processConversion(job.jobId, parsedOptions);

      const response = ConvertResponseSchema.parse({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      });
      return c.json(response);
    } catch (error) {
      console.error("Direct convert error:", error);
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Direct conversion failed",
      });
      return c.json(errorResponse, 500);
    }
  };

  handlePreview = async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json();
      const convertRequest = ConvertRequestSchema.parse(body);

      if (typeof convertRequest.file !== "string") {
        const errorResponse = ApiErrorResponseSchema.parse({
          success: false,
          error: "Invalid file reference",
        });
        return c.json(errorResponse, 400);
      }

      const outputPath = this.storage.getOutputPath(convertRequest.file, convertRequest.outputFormat);
      const command = this.ffmpeg.buildCommand({
        inputFile: convertRequest.file,
        outputFile: outputPath,
        options: convertRequest.options,
      });

      const response = PreviewResponseSchema.parse({
        success: true,
        data: { command },
      });
      return c.json(response);
    } catch (error) {
      console.error("Preview error:", error);
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Preview failed",
      });
      return c.json(errorResponse, 500);
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

  handleTestSource = async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json();
      const parseResult = TestSourceRequestSchema.safeParse(body);

      if (!parseResult.success) {
        const errorResponse = ApiErrorResponseSchema.parse({
          success: false,
          error: parseResult.error.flatten().fieldErrors,
        });
        return c.json(errorResponse, 400);
      }

      const { options, batch } = parseResult.data;

      // Dynamic import to avoid circular dependency issues
      const { TestSourceService } = await import("../services/testSourceService");
      const testSourceService = new TestSourceService(this.wsManager, this.jobs);

      if (batch) {
        // Batch generation
        const jobs = await testSourceService.generateBatch(batch);
        const response = TestSourceBatchResponseSchema.parse({
          success: true,
          data: {
            jobs: jobs.map((job) => ({
              jobId: job.jobId,
              status: job.status,
            })),
          },
        });
        return c.json(response);
      }
      // Single generation
      const job = await testSourceService.generateTestSource(options);
      const response = TestSourceResponseSchema.parse({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      });
      return c.json(response);
    } catch (error) {
      console.error("Test source error:", error);
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Test source generation failed",
      });
      return c.json(errorResponse, 500);
    }
  };

  handleTestSourcePresets = async (c: Context): Promise<Response> => {
    try {
      // Dynamic import to avoid circular dependency issues
      const { TestSourceService } = await import("../services/testSourceService");
      const testSourceService = new TestSourceService(this.wsManager, this.jobs);
      const presets = testSourceService.getPresets();

      const response = TestSourcePresetsResponseSchema.parse({
        success: true,
        data: { presets },
      });
      return c.json(response);
    } catch (error) {
      console.error("Get presets error:", error);
      const errorResponse = ApiErrorResponseSchema.parse({
        success: false,
        error: "Failed to get presets",
      });
      return c.json(errorResponse, 500);
    }
  };
}
