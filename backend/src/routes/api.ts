import { ApiResponse } from "@convconv/shared/types/api";
import { ConvertRequestSchema } from "@convconv/shared/schemas/api";
import { StorageService } from "../services/storage";
import { JobService } from "../services/jobs";
import { FFmpegService } from "../services/ffmpeg";
import { WebSocketManager } from "../utils/websocket";
import { config } from "../config";

export class ApiRouter {
  constructor(
    private storage: StorageService,
    private jobs: JobService,
    private ffmpeg: FFmpegService,
    private wsManager: WebSocketManager
  ) {}

  handleUpload = async (request: Request): Promise<Response> => {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      
      if (!file || !(file instanceof File)) {
        return Response.json({
          success: false,
          error: "No file provided",
        } as ApiResponse<any>, { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          }
        });
      }
      
      const filePath = await this.storage.saveUploadedFile(file);
      
      return Response.json({
        success: true,
        data: { filePath },
      } as ApiResponse<{ filePath: string }>, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      });
    } catch (error) {
      console.error("Upload error:", error);
      return Response.json({
        success: false,
        error: "Upload failed",
      } as ApiResponse<any>, { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      });
    }
  };

  handleConvert = async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const convertRequest = ConvertRequestSchema.parse(body);
      
      // Assume file is a path string for server-side processing
      if (typeof convertRequest.file !== "string") {
        return Response.json({
          success: false,
          error: "Invalid file reference",
        } as ApiResponse<any>, { status: 400 });
      }
      
      const outputPath = this.storage.getOutputPath(
        convertRequest.file,
        convertRequest.outputFormat
      );
      
      const job = this.jobs.createJob(convertRequest.file, outputPath);
      
      // Start conversion in background
      this.processConversion(job.jobId);
      
      return Response.json({
        success: true,
        data: {
          jobId: job.jobId,
          status: job.status,
        },
      } as ApiResponse<any>);
    } catch (error) {
      console.error("Convert error:", error);
      return Response.json({
        success: false,
        error: "Conversion request failed",
      } as ApiResponse<any>, { status: 500 });
    }
  };

  handleJobStatus = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const jobId = url.pathname.split("/").pop();
    
    if (!jobId) {
      return Response.json({
        success: false,
        error: "Job ID required",
      } as ApiResponse<any>, { status: 400 });
    }
    
    const job = this.jobs.getJob(jobId);
    if (!job) {
      return Response.json({
        success: false,
        error: "Job not found",
      } as ApiResponse<any>, { status: 404 });
    }
    
    return Response.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        downloadUrl: job.downloadUrl,
      },
    } as ApiResponse<any>);
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
    return new Response(file);
  };

  private processConversion = async (jobId: string) => {
    const job = this.jobs.startJob(jobId);
    if (!job) return;
    
    this.wsManager.broadcast(jobId, { type: "progress", data: { progress: 0 } });
    
    const result = await this.ffmpeg.execute(
      {
        inputFile: job.inputPath,
        outputFile: job.outputPath,
      },
      (progress) => {
        this.jobs.updateProgress(jobId, progress.percent);
        this.wsManager.broadcast(jobId, {
          type: "progress",
          data: progress,
        });
      }
    );
    
    if (result.success) {
      const downloadUrl = `/api/download/${jobId}`;
      this.jobs.completeJob(jobId, downloadUrl);
      this.wsManager.broadcast(jobId, {
        type: "complete",
        data: { downloadUrl },
      });
    } else {
      this.jobs.failJob(jobId, result.error || "Unknown error");
      this.wsManager.broadcast(jobId, {
        type: "error",
        data: { error: result.error },
      });
    }
  };
}