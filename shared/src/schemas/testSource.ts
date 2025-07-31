import { z } from "zod";

export const TestPatternSchema = z.enum([
  "smpte",
  "ebu",
  "hd",
  "grayscale",
  "resolution",
  "solid",
  "gradient",
  "checkerboard",
  "noise",
]);

export const AudioTypeSchema = z.enum(["sine", "white-noise", "pink-noise", "silence"]);

export const AudioChannelSchema = z.enum(["mono", "stereo"]);

export const SampleRateSchema = z.union([z.literal(44100), z.literal(48000), z.literal(96000)]);

export const BitDepthSchema = z.union([z.literal(16), z.literal(24)]);

export const TestSourceOptionsSchema = z.object({
  pattern: TestPatternSchema,
  resolution: z.string().regex(/^\d+x\d+$/),
  duration: z.number().min(1).max(3600),
  frameRate: z.number().min(1).max(120).optional(),

  // Audio options
  audioType: AudioTypeSchema,
  audioFrequency: z.number().min(20).max(20000).optional(),
  audioChannel: AudioChannelSchema,
  sampleRate: SampleRateSchema,
  bitDepth: BitDepthSchema,

  // Overlay options
  showTimecode: z.boolean().optional(),
  showFrameCounter: z.boolean().optional(),
  showMetadata: z.boolean().optional(),
  customText: z.string().max(100).optional(),

  // Output options
  format: z.string(),
  codec: z.string().optional(),
  preset: z.string().optional(),
});

export const TestSourcePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  options: TestSourceOptionsSchema,
  isBuiltIn: z.boolean(),
});

export const TestSourceBatchSchema = z.object({
  baseOptions: TestSourceOptionsSchema,
  variations: z.object({
    resolutions: z.array(z.string().regex(/^\d+x\d+$/)).optional(),
    patterns: z.array(TestPatternSchema).optional(),
    formats: z.array(z.string()).optional(),
  }),
});

export const TestSourceRequestSchema = z.object({
  options: TestSourceOptionsSchema,
  batch: TestSourceBatchSchema.optional(),
});
