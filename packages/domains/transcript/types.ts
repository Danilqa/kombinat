import type { z } from 'zod';

import type {
  hookItemSchema,
  hookPhaseSchema,
  initItemSchema,
  messageItemSchema,
  messageSourceSchema,
  modelFallbackItemSchema,
  resultItemSchema,
  retryEndSchema,
  retryItemSchema,
  retryOutcomeSchema,
  textItemSchema,
  toolItemSchema,
  toolResultSchema,
  transcriptItemSchema,
  transcriptSchema,
  usageLimitEndSchema,
  usageLimitItemSchema,
  usageLimitKindSchema,
  usageLimitOutcomeSchema,
} from './schemas';

export type ToolResult = z.infer<typeof toolResultSchema>;
export type TranscriptItem = z.infer<typeof transcriptItemSchema>;
export type HookItem = z.infer<typeof hookItemSchema>;
export type HookPhase = z.infer<typeof hookPhaseSchema>;
export type InitItem = z.infer<typeof initItemSchema>;
export type ModelFallbackItem = z.infer<typeof modelFallbackItemSchema>;
export type TextItem = z.infer<typeof textItemSchema>;
export type MessageItem = z.infer<typeof messageItemSchema>;
export type MessageSource = z.infer<typeof messageSourceSchema>;
export type ToolItem = z.infer<typeof toolItemSchema>;
export type ResultItem = z.infer<typeof resultItemSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type UsageLimitKind = z.infer<typeof usageLimitKindSchema>;
export type UsageLimitOutcome = z.infer<typeof usageLimitOutcomeSchema>;
export type UsageLimitEnd = z.infer<typeof usageLimitEndSchema>;
export type UsageLimitItem = z.infer<typeof usageLimitItemSchema>;
export type RetryOutcome = z.infer<typeof retryOutcomeSchema>;
export type RetryEnd = z.infer<typeof retryEndSchema>;
export type RetryItem = z.infer<typeof retryItemSchema>;
