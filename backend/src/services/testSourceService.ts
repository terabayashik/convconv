import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
  TestSourceBatch,
  TestSourceJob,
  TestSourceOptions,
  TestSourcePreset,
} from "@convconv/shared/types/testSource";
import { parseFFmpegProgress } from "../utils/ffmpegParser";
import type { WebSocketManager } from "../utils/websocket";
import type { JobService } from "./jobs";
import { storageService } from "./storageService";

class TestSourceService {
  constructor(
    private wsManager: WebSocketManager,
    private jobs: JobService,
  ) {}
  generateTestSource = async (options: TestSourceOptions): Promise<TestSourceJob> => {
    const jobId = randomUUID();
    const outputFilename = `test_${jobId}.${options.format}`;
    const outputPath = join(storageService.getOutputDir(), outputFilename);

    const job: TestSourceJob & { outputPath: string } = {
      jobId,
      type: "test-source",
      options,
      status: "pending",
      outputPath,
    };

    // Store the job in the regular job service
    // Create a job manually with the specific ID
    const jobObj = {
      jobId,
      status: "pending" as const,
      inputPath: `test-source:${options.pattern}`,
      outputPath,
    };
    // Add the job to the service
    // Use the createJob method with the specific jobId
    this.jobs.createJob(jobObj.inputPath, jobObj.outputPath, jobId);

    // Run FFmpeg in background
    // Use setTimeout(0) instead of setImmediate for Bun compatibility
    setTimeout(() => {
      console.log(`[TestSource] Starting generation for job ${job.jobId}`);
      this.runTestSourceGeneration(job);
    }, 0);

    return job;
  };

  private runTestSourceGeneration = async (job: TestSourceJob & { outputPath: string }) => {
    try {
      job.status = "processing";
      this.jobs.updateJob(job.jobId, { status: job.status });

      const command = this.buildFFmpegCommand(job.options, job.outputPath);
      console.log("FFmpeg command:", command.join(" "));

      const ffmpeg = spawn(command[0] as string, command.slice(1)) as ChildProcess;

      let _stderr = "";

      let lastProgressTime = 0;
      let lastPercent = 0;

      // Progress data comes from stderr when using -progress pipe:2
      ffmpeg.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        _stderr += chunk;

        // Try to parse progress from the latest chunk
        const lines = chunk.split("\n");
        for (const line of lines) {
          // Check for time-based progress (standard FFmpeg output)
          const progressMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})/);
          if (progressMatch) {
            const hours = Number.parseInt(progressMatch[1] as string, 10);
            const minutes = Number.parseInt(progressMatch[2] as string, 10);
            const seconds = Number.parseInt(progressMatch[3] as string, 10);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const percent = job.options.duration > 0 ? Math.round((currentTime / job.options.duration) * 100) : 0;

            const now = Date.now();
            if (percent !== lastPercent || now - lastProgressTime > 500) {
              lastPercent = percent;
              lastProgressTime = now;

              console.log(`[TestSource] Progress for job ${job.jobId}: ${percent}%`);
              job.progress = Math.min(percent, 100);
              this.jobs.updateJob(job.jobId, { progress: job.progress });

              this.wsManager.broadcastProgress(job.jobId, {
                percent: Math.min(percent, 100),
                time: progressMatch[0].split("=")[1] as string,
                bitrate: "",
                speed: "",
              });
            }
          }

          // Also try parsing structured progress format
          const progress = parseFFmpegProgress(line, job.options.duration);
          if (progress && progress.percent > lastPercent) {
            const now = Date.now();
            if (now - lastProgressTime > 500) {
              lastPercent = progress.percent;
              lastProgressTime = now;

              console.log(`[TestSource] Progress for job ${job.jobId}: ${progress.percent}%`);
              job.progress = progress.percent;
              this.jobs.updateJob(job.jobId, { progress: job.progress });

              this.wsManager.broadcastProgress(job.jobId, {
                percent: progress.percent,
                time: progress.time || "00:00:00",
                bitrate: progress.bitrate || "",
                speed: progress.speed?.toString() || "",
              });
            }
          }
        }
      });

      ffmpeg.on("close", (code: number | null) => {
        if (code === 0) {
          job.status = "completed";
          job.progress = 100;
          this.jobs.updateJob(job.jobId, {
            status: "completed",
            progress: 100,
            downloadUrl: `/api/download/${job.jobId}`,
          });

          this.wsManager.broadcastComplete(job.jobId, `/api/download/${job.jobId}`);
        } else {
          job.status = "failed";
          job.error = `FFmpeg process exited with code ${code}`;
          this.jobs.updateJob(job.jobId, {
            status: "failed",
          });

          this.wsManager.broadcastError(job.jobId, job.error);
        }
      });

      ffmpeg.on("error", (error: Error) => {
        job.status = "failed";
        job.error = error.message;
        this.jobs.updateJob(job.jobId, {
          status: "failed",
        });

        this.wsManager.broadcastError(job.jobId, error.message);
      });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown error";
      this.jobs.updateJob(job.jobId, {
        status: "failed",
      });

      this.wsManager.broadcastError(job.jobId, job.error);
    }
  };

  private buildFFmpegCommand = (options: TestSourceOptions, outputPath: string): string[] => {
    const args = ["ffmpeg", "-hide_banner"];

    // Video input
    const videoFilter = this.getVideoFilter(options);
    args.push("-f", "lavfi", "-i", videoFilter);

    // Audio input
    const audioFilter = this.getAudioFilter(options);
    args.push("-f", "lavfi", "-i", audioFilter);

    // Duration
    args.push("-t", options.duration.toString());

    // Frame rate
    if (options.frameRate) {
      args.push("-r", options.frameRate.toString());
    }

    // Video codec
    if (options.codec) {
      args.push("-c:v", options.codec);
    } else {
      // Auto-select codec based on format
      const codec = this.getDefaultVideoCodec(options.format);
      if (codec) {
        args.push("-c:v", codec);
      }
    }

    // Audio codec and settings
    args.push("-c:a", this.getDefaultAudioCodec(options.format));
    args.push("-ar", options.sampleRate.toString());
    args.push("-ac", options.audioChannel === "stereo" ? "2" : "1");

    // Overlays
    if (options.showTimecode || options.showFrameCounter || options.showMetadata || options.customText) {
      args.push("-vf", this.buildOverlayFilter(options));
    }

    // Progress reporting
    args.push("-progress", "pipe:2");

    // Output
    args.push("-y", outputPath);

    return args;
  };

  private getVideoFilter = (options: TestSourceOptions): string => {
    const size = options.resolution;

    switch (options.pattern) {
      case "smpte":
        return `smptebars=size=${size}`;
      case "ebu":
        return `smptebars=size=${size}`;
      case "hd":
        return `smptehdbars=size=${size}`;
      case "grayscale":
        return `color=gray:size=${size}`;
      case "resolution":
        return `testsrc=size=${size}`;
      case "solid":
        return `color=white:size=${size}`;
      case "gradient":
        return `gradients=size=${size}`;
      case "checkerboard":
        return `testsrc2=size=${size}`;
      case "noise":
        return `noise=alls=20:allf=t+u:size=${size}`;
      default:
        return `testsrc=size=${size}`;
    }
  };

  private getAudioFilter = (options: TestSourceOptions): string => {
    switch (options.audioType) {
      case "sine":
        return `sine=frequency=${options.audioFrequency || 1000}:sample_rate=${options.sampleRate}`;
      case "white-noise":
        return `anoisesrc=color=white:sample_rate=${options.sampleRate}`;
      case "pink-noise":
        return `anoisesrc=color=pink:sample_rate=${options.sampleRate}`;
      case "silence":
        return `anullsrc=sample_rate=${options.sampleRate}`;
      default:
        return `anullsrc=sample_rate=${options.sampleRate}`;
    }
  };

  private buildOverlayFilter = (options: TestSourceOptions): string => {
    const filters: string[] = [];
    let y = 10;

    if (options.showTimecode) {
      filters.push(`drawtext=text='%{pts\\:hms}':x=10:y=${y}:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5`);
      y += 40;
    }

    if (options.showFrameCounter) {
      filters.push(`drawtext=text='Frame\\: %{n}':x=10:y=${y}:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5`);
      y += 40;
    }

    if (options.showMetadata) {
      filters.push(
        `drawtext=text='${options.resolution} @ ${options.frameRate || 25}fps':x=10:y=${y}:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5`,
      );
      y += 40;
    }

    if (options.customText) {
      const escapedText = options.customText.replace(/'/g, "\\'");
      filters.push(`drawtext=text='${escapedText}':x=10:y=${y}:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5`);
    }

    return filters.join(",");
  };

  private getDefaultVideoCodec = (format: string): string | null => {
    switch (format.toLowerCase()) {
      case "mp4":
      case "mov":
        return "libx264";
      case "webm":
        return "libvpx-vp9";
      case "avi":
        return "mpeg4";
      case "mkv":
        return "libx264";
      case "mxf":
        return "mpeg2video";
      default:
        return null;
    }
  };

  private getDefaultAudioCodec = (format: string): string => {
    switch (format.toLowerCase()) {
      case "mp4":
      case "mov":
        return "aac";
      case "webm":
        return "libopus";
      case "avi":
        return "mp3";
      case "mkv":
        return "aac";
      case "mxf":
        return "pcm_s16le";
      default:
        return "aac";
    }
  };

  getPresets = (): TestSourcePreset[] => {
    return [
      {
        id: "broadcast-hd",
        name: "放送用HDテスト",
        description: "標準HD放送テスト信号",
        isBuiltIn: true,
        options: {
          pattern: "smpte",
          resolution: "1920x1080",
          duration: 30,
          frameRate: 29.97,
          audioType: "sine",
          audioFrequency: 1000,
          audioChannel: "stereo",
          sampleRate: 48000,
          bitDepth: 16,
          format: "mp4",
          showTimecode: true,
        },
      },
      {
        id: "web-720p",
        name: "Web 720pテスト",
        description: "標準Web動画テスト",
        isBuiltIn: true,
        options: {
          pattern: "resolution",
          resolution: "1280x720",
          duration: 10,
          frameRate: 30,
          audioType: "sine",
          audioFrequency: 440,
          audioChannel: "stereo",
          sampleRate: 44100,
          bitDepth: 16,
          format: "mp4",
        },
      },
      {
        id: "4k-test",
        name: "4K UHDテスト",
        description: "超高精細テストパターン",
        isBuiltIn: true,
        options: {
          pattern: "hd",
          resolution: "3840x2160",
          duration: 10,
          frameRate: 60,
          audioType: "silence",
          audioChannel: "stereo",
          sampleRate: 48000,
          bitDepth: 24,
          format: "mp4",
          showMetadata: true,
        },
      },
    ];
  };

  generateBatch = async (batch: TestSourceBatch): Promise<TestSourceJob[]> => {
    const jobs: TestSourceJob[] = [];
    const variations = this.generateVariations(batch);

    for (const options of variations) {
      const job = await this.generateTestSource(options);
      jobs.push(job);
    }

    return jobs;
  };

  private generateVariations = (batch: TestSourceBatch): TestSourceOptions[] => {
    const { baseOptions, variations } = batch;
    const optionsList: TestSourceOptions[] = [];

    const resolutions = variations.resolutions || [baseOptions.resolution];
    const patterns = variations.patterns || [baseOptions.pattern];
    const formats = variations.formats || [baseOptions.format];

    for (const resolution of resolutions) {
      for (const pattern of patterns) {
        for (const format of formats) {
          optionsList.push({
            ...baseOptions,
            resolution,
            pattern,
            format,
          });
        }
      }
    }

    return optionsList;
  };
}

export { TestSourceService };
