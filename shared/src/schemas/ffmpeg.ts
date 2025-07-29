import { z } from "zod";

export const FFmpegOptionsSchema = z.object({
  codec: z.string().optional(),
  bitrate: z.string().optional(),
  format: z.string().optional(),
  customArgs: z.array(z.string()).optional(),
});

export const FFmpegCommandSchema = z.object({
  inputFile: z.string(),
  outputFile: z.string(),
  options: FFmpegOptionsSchema.optional(),
});

export const FFmpegProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  time: z.string(),
  bitrate: z.string(),
  speed: z.string(),
});

export const FFmpegResultSchema = z.object({
  success: z.boolean(),
  outputPath: z.string().optional(),
  error: z.string().optional(),
  duration: z.number().optional(),
});

export type FFmpegOptions = z.infer<typeof FFmpegOptionsSchema>;
export type FFmpegCommand = z.infer<typeof FFmpegCommandSchema>;
export type FFmpegProgress = z.infer<typeof FFmpegProgressSchema>;
export type FFmpegResult = z.infer<typeof FFmpegResultSchema>;