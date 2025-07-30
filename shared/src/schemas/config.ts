import { z } from "zod";

export const AppConfigSchema = z.object({
  server: z.object({
    port: z.number().int().positive().default(3000),
    host: z.string().default("localhost"),
  }),
  storage: z.object({
    uploadDir: z.string().default("./uploads"),
    outputDir: z.string().default("./outputs"),
    retentionHours: z.number().positive().default(24), // デフォルト24時間
    cleanupIntervalMinutes: z.number().positive().default(60), // デフォルト1時間ごと
  }),
  ffmpeg: z.object({
    binaryPath: z.string().optional(),
    defaultThreads: z.number().int().positive().optional(),
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
