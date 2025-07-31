import { z } from "zod";

// Generic API response schemas
export const ApiSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.union([z.string(), z.record(z.any())]),
});

export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.union([ApiSuccessResponseSchema(dataSchema), ApiErrorResponseSchema]);

// Specific response schemas
export const UploadResponseSchema = ApiResponseSchema(
  z.object({
    filePath: z.string(),
  }),
);

export const ConvertResponseSchema = ApiResponseSchema(
  z.object({
    jobId: z.string(),
    status: z.string(),
  }),
);

export const JobStatusResponseSchema = ApiResponseSchema(
  z.object({
    jobId: z.string(),
    status: z.string(),
    progress: z.number().optional(),
    downloadUrl: z.string().optional(),
  }),
);

export const PreviewResponseSchema = ApiResponseSchema(
  z.object({
    command: z.array(z.string()),
  }),
);

export const TestSourceResponseSchema = ApiResponseSchema(
  z.object({
    jobId: z.string(),
    status: z.string(),
  }),
);

export const TestSourceBatchResponseSchema = ApiResponseSchema(
  z.object({
    jobs: z.array(
      z.object({
        jobId: z.string(),
        status: z.string(),
      }),
    ),
  }),
);

export const TestSourcePresetsResponseSchema = ApiResponseSchema(
  z.object({
    presets: z.array(z.any()), // We'll use the actual TestSourcePresetSchema when needed
  }),
);
