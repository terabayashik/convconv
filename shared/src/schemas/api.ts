import { z } from "zod";

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });

export const ConvertRequestSchema = z.object({
  file: z.union([z.instanceof(File), z.string()]),
  outputFormat: z.string(),
  options: z.record(z.unknown()).optional(),
});

export const ConvertResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100).optional(),
  downloadUrl: z.string().optional(),
});

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
export type ConvertRequest = z.infer<typeof ConvertRequestSchema>;
export type ConvertResponse = z.infer<typeof ConvertResponseSchema>;
