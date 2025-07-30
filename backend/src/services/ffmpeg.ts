import { spawn } from "node:child_process";
import { FFmpegCommandSchema, FFmpegProgressSchema } from "@convconv/shared/schemas/ffmpeg";
import type { FFmpegCommand, FFmpegProgress, FFmpegResult } from "@convconv/shared/types/ffmpeg";

export class FFmpegService {
  private ffmpegPath: string;

  constructor(ffmpegPath = "ffmpeg") {
    this.ffmpegPath = ffmpegPath;
  }

  execute = async (command: FFmpegCommand, onProgress?: (progress: FFmpegProgress) => void): Promise<FFmpegResult> => {
    const validatedCommand = FFmpegCommandSchema.parse(command);

    return new Promise((resolve, _reject) => {
      const args = this.buildArgs(validatedCommand);
      const ffmpeg = spawn(this.ffmpegPath, args);

      let stderr = "";
      let duration = 0;

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();

        // Parse duration
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch && duration === 0 && durationMatch[1] && durationMatch[2] && durationMatch[3]) {
          const hours = Number.parseInt(durationMatch[1]);
          const minutes = Number.parseInt(durationMatch[2]);
          const seconds = Number.parseInt(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        // Parse progress
        const progressMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}).*bitrate=\s*(\S+).*speed=\s*(\S+)/);
        if (
          progressMatch &&
          onProgress &&
          progressMatch[1] &&
          progressMatch[2] &&
          progressMatch[3] &&
          progressMatch[4] &&
          progressMatch[5]
        ) {
          const hours = Number.parseInt(progressMatch[1]);
          const minutes = Number.parseInt(progressMatch[2]);
          const seconds = Number.parseInt(progressMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const percent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

          const timeMatch = progressMatch[0].match(/time=(\S+)/);
          const progress: FFmpegProgress = {
            percent: Math.min(percent, 100),
            time: timeMatch?.[1] ?? "00:00:00",
            bitrate: progressMatch[4],
            speed: progressMatch[5],
          };

          try {
            const validatedProgress = FFmpegProgressSchema.parse(progress);
            onProgress(validatedProgress);
          } catch (error) {
            console.error("Invalid progress data:", error);
          }
        }
      });

      ffmpeg.on("error", (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve({
            success: true,
            outputPath: validatedCommand.outputFile,
            duration,
          });
        } else {
          resolve({
            success: false,
            error: `FFmpeg exited with code ${code}\n${stderr}`,
          });
        }
      });
    });
  };

  buildCommand = (params: { inputFile: string; outputFile: string; options?: Record<string, unknown> }): string => {
    const args = this.buildArgs({
      inputFile: params.inputFile,
      outputFile: params.outputFile,
      options: params.options,
    });
    return `${this.ffmpegPath} ${args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" ")}`;
  };

  private buildArgs = (command: FFmpegCommand): string[] => {
    const args: string[] = [
      "-i",
      command.inputFile,
      "-progress",
      "pipe:2",
      "-y", // Overwrite output file
    ];

    // Handle video scaling
    if (command.options?.scale) {
      const scale = command.options.scale;
      if (typeof scale === "string" && scale.match(/^\d+x\d+$/)) {
        const [width, height] = scale.split("x");
        args.push("-vf", `scale=${width}:${height}`);
      }
    }

    // Auto-detect codec based on output format
    const outputExt = command.outputFile.split(".").pop()?.toLowerCase();
    if (!command.options?.codec) {
      switch (outputExt) {
        case "mp4":
          args.push("-c:v", "libx264", "-c:a", "aac");
          break;
        case "webm":
          args.push("-c:v", "libvpx-vp9", "-c:a", "libopus");
          break;
        case "mp3":
          args.push("-c:a", "libmp3lame", "-q:a", "2");
          break;
        case "aac":
          args.push("-c:a", "aac", "-b:a", "192k");
          break;
        case "wav":
          args.push("-c:a", "pcm_s16le");
          break;
        case "flac":
          args.push("-c:a", "flac");
          break;
      }
    } else if (command.options?.codec) {
      args.push("-c", command.options.codec);
    }

    if (command.options?.bitrate) {
      args.push("-b:v", command.options.bitrate);
    }

    if (command.options?.format) {
      args.push("-f", command.options.format);
    }

    if (command.options?.customArgs) {
      args.push(...command.options.customArgs);
    }

    args.push(command.outputFile);

    return args;
  };
}
