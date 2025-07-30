import { z } from "zod";
import { FFmpegProgressSchema } from "./ffmpeg";

// Base message schema
const WSMessageBaseSchema = z.object({
  jobId: z.string(),
});

// Progress message
export const WSProgressMessageSchema = WSMessageBaseSchema.extend({
  type: z.literal("progress"),
  data: FFmpegProgressSchema,
});

// Complete message
export const WSCompleteMessageSchema = WSMessageBaseSchema.extend({
  type: z.literal("complete"),
  data: z.object({
    downloadUrl: z.string(),
  }),
});

// Error message
export const WSErrorMessageSchema = WSMessageBaseSchema.extend({
  type: z.literal("error"),
  data: z.object({
    error: z.string(),
  }),
});

// Subscribe message
export const WSSubscribeMessageSchema = WSMessageBaseSchema.extend({
  type: z.literal("subscribe"),
});

// Subscribed message
export const WSSubscribedMessageSchema = WSMessageBaseSchema.extend({
  type: z.literal("subscribed"),
});

// Union of all message types
export const WSMessageSchema = z.discriminatedUnion("type", [
  WSProgressMessageSchema,
  WSCompleteMessageSchema,
  WSErrorMessageSchema,
  WSSubscribeMessageSchema,
  WSSubscribedMessageSchema,
]);

// Type exports
export type WSProgressMessage = z.infer<typeof WSProgressMessageSchema>;
export type WSCompleteMessage = z.infer<typeof WSCompleteMessageSchema>;
export type WSErrorMessage = z.infer<typeof WSErrorMessageSchema>;
export type WSSubscribeMessage = z.infer<typeof WSSubscribeMessageSchema>;
export type WSSubscribedMessage = z.infer<typeof WSSubscribedMessageSchema>;
export type WSMessage = z.infer<typeof WSMessageSchema>;
