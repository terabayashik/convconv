import { spawn } from "node:child_process";
import { FFmpegCommand, FFmpegProgress, FFmpegResult } from "@convconv/shared/types/ffmpeg";
import { FFmpegCommandSchema, FFmpegProgressSchema } from "@convconv/shared/schemas/ffmpeg";

export class FFmpegService {
  private ffmpegPath: string;

  constructor(ffmpegPath = "ffmpeg") {
    this.ffmpegPath = ffmpegPath;
  }

  execute = async (
    command: FFmpegCommand,
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<FFmpegResult> => {
    const validatedCommand = FFmpegCommandSchema.parse(command);
    
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(validatedCommand);
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      let stderr = "";
      let duration = 0;
      
      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
        
        // Parse duration
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch && duration === 0) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
        
        // Parse progress
        const progressMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}).*bitrate=\s*(\S+).*speed=\s*(\S+)/);
        if (progressMatch && onProgress) {
          const hours = parseInt(progressMatch[1]);
          const minutes = parseInt(progressMatch[2]);
          const seconds = parseInt(progressMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const percent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
          
          const progress: FFmpegProgress = {
            percent: Math.min(percent, 100),
            time: progressMatch[0].match(/time=(\S+)/)![1],
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

  private buildArgs = (command: FFmpegCommand): string[] => {
    const args: string[] = [
      "-i", command.inputFile,
      "-progress", "pipe:2",
      "-y", // Overwrite output file
    ];
    
    if (command.options?.codec) {
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