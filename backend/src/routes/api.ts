import { ConvertRequestSchema } from "@convconv/shared/schemas/api";
import { TestSourceRequestSchema } from "@convconv/shared/schemas/testSource";
import type { ApiResponse, ConvertResponse } from "@convconv/shared/types/api";
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
        return c.json(
          {
            success: false,
            error: "No file provided",
          } as ApiResponse<never>,
          400,
        );
      }

      const filePath = await this.storage.saveUploadedFile(file);

      return c.json({
        success: true,
        data: { filePath },
      } as ApiResponse<{ filePath: string }>);
    } catch (error) {
      console.error("Upload error:", error);
      return c.json(
        {
          success: false,
          error: "Upload failed",
        } as ApiResponse<never>,
        500,
      );
    }
  };

  handleConvert = async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json();
      const convertRequest = ConvertRequestSchema.parse(body);

      // Assume file is a path string for server-side processing
      if (typeof convertRequest.file !== "string") {
        return c.json(
          {
            success: false,
            error: "Invalid file reference",
          } as ApiResponse<never>,
          400,
        );
      }

      const outputPath = this.storage.getOutputPath(convertRequest.file, convertRequest.outputFormat);

      const job = this.jobs.createJob(convertRequest.file, outputPath);

      // Start conversion in background
      this.processConversion(job.jobId, convertRequest.options);

      return c.json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      } as ApiResponse<ConvertResponse>);
    } catch (error) {
      console.error("Convert error:", error);
      return c.json(
        {
          success: false,
          error: "Conversion request failed",
        } as ApiResponse<never>,
        500,
      );
    }
  };

  handleJobStatus = async (c: Context): Promise<Response> => {
    const jobId = c.req.param("jobId");

    if (!jobId) {
      return c.json(
        {
          success: false,
          error: "Job ID required",
        } as ApiResponse<never>,
        400,
      );
    }

    const job = this.jobs.getJob(jobId);
    if (!job) {
      return c.json(
        {
          success: false,
          error: "Job not found",
        } as ApiResponse<never>,
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        downloadUrl: job.downloadUrl,
      },
    } as ApiResponse<ConvertResponse>);
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
        return c.json(
          {
            success: false,
            error: "No file provided",
          } as ApiResponse<never>,
          400,
        );
      }

      if (!outputFormat || typeof outputFormat !== "string") {
        return c.json(
          {
            success: false,
            error: "Output format required",
          } as ApiResponse<never>,
          400,
        );
      }

      // Parse options if provided
      let parsedOptions: Record<string, unknown> | undefined;
      if (options && typeof options === "string") {
        try {
          parsedOptions = JSON.parse(options);
        } catch {
          return c.json(
            {
              success: false,
              error: "Invalid options JSON",
            } as ApiResponse<never>,
            400,
          );
        }
      }

      // Save uploaded file
      const filePath = await this.storage.saveUploadedFile(file);

      // Create conversion job
      const outputPath = this.storage.getOutputPath(filePath, outputFormat);
      const job = this.jobs.createJob(filePath, outputPath);

      // Start conversion in background
      this.processConversion(job.jobId, parsedOptions);

      return c.json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      } as ApiResponse<ConvertResponse>);
    } catch (error) {
      console.error("Direct convert error:", error);
      return c.json(
        {
          success: false,
          error: "Direct conversion failed",
        } as ApiResponse<never>,
        500,
      );
    }
  };

  handlePreview = async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json();
      const convertRequest = ConvertRequestSchema.parse(body);

      if (typeof convertRequest.file !== "string") {
        return c.json(
          {
            success: false,
            error: "Invalid file reference",
          },
          400,
        );
      }

      const outputPath = this.storage.getOutputPath(convertRequest.file, convertRequest.outputFormat);
      const command = this.ffmpeg.buildCommand({
        inputFile: convertRequest.file,
        outputFile: outputPath,
        options: convertRequest.options,
      });

      return c.json({
        success: true,
        data: { command },
      });
    } catch (error) {
      console.error("Preview error:", error);
      return c.json(
        {
          success: false,
          error: "Preview failed",
        },
        500,
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

  handleTestSource = async (c: Context): Promise<Response> => {
    try {
      const body = await c.req.json();
      const parseResult = TestSourceRequestSchema.safeParse(body);

      if (!parseResult.success) {
        return c.json(
          {
            success: false,
            error: parseResult.error.flatten().fieldErrors,
          } as ApiResponse<never>,
          400,
        );
      }

      const { options, batch } = parseResult.data;

      // Dynamic import to avoid circular dependency issues
      const { TestSourceService } = await import("../services/testSourceService");
      const testSourceService = new TestSourceService(this.wsManager, this.jobs);

      if (batch) {
        // Batch generation
        const jobs = await testSourceService.generateBatch(batch);
        return c.json({
          success: true,
          data: {
            jobs: jobs.map((job) => ({
              jobId: job.jobId,
              status: job.status,
            })),
          },
        } as ApiResponse<{ jobs: Array<{ jobId: string; status: string }> }>);
      }
      // Single generation
      const job = await testSourceService.generateTestSource(options);
      return c.json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      } as ApiResponse<{ jobId: string; status: string }>);
    } catch (error) {
      console.error("Test source error:", error);
      return c.json(
        {
          success: false,
          error: "Test source generation failed",
        } as ApiResponse<never>,
        500,
      );
    }
  };

  handleTestSourcePresets = async (c: Context): Promise<Response> => {
    try {
      // Dynamic import to avoid circular dependency issues
      const { TestSourceService } = await import("../services/testSourceService");
      const testSourceService = new TestSourceService(this.wsManager, this.jobs);
      const presets = testSourceService.getPresets();

      return c.json({
        success: true,
        data: { presets },
      } as ApiResponse<{ presets: typeof presets }>);
    } catch (error) {
      console.error("Get presets error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to get presets",
        } as ApiResponse<never>,
        500,
      );
    }
  };
}
