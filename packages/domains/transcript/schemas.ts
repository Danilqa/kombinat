import { z } from 'zod';

export const toolResultSchema = z.object({ content: z.string(), isError: z.boolean() });

export const hookPhaseSchema = z.enum(['before', 'after']);

export const hookItemSchema = z.object({
  kind: z.literal('hook'),
  key: z.string(),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
  phase: hookPhaseSchema,
});

export const initItemSchema = z.object({
  kind: z.literal('init'),
  key: z.string(),
  model: z.string().nullable(),
  cwd: z.string().nullable(),
  toolCount: z.number().nullable(),
  permissionMode: z.string().nullable(),
});

export const modelFallbackItemSchema = z.object({
  kind: z.literal('model-fallback'),
  key: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string().nullable(),
});

export const textItemSchema = z.object({
  kind: z.literal('text'),
  key: z.string(),
  text: z.string(),
  isSubagent: z.boolean(),
});

export const messageSourceSchema = z.enum(['dashboard', 'webhook']);

export const messageItemSchema = z.object({
  kind: z.literal('message'),
  key: z.string(),
  text: z.string(),
  source: messageSourceSchema,
});

export const toolItemSchema = z.object({
  kind: z.literal('tool'),
  key: z.string(),
  id: z.string(),
  name: z.string(),
  input: z.unknown().optional(),
  preview: z.string(),
  result: toolResultSchema.nullable(),
  isSubagent: z.boolean(),
});

export const resultItemSchema = z.object({
  kind: z.literal('result'),
  key: z.string(),
  text: z.string(),
  isError: z.boolean(),
  costUsd: z.number().nullable(),
  numTurns: z.number().nullable(),
  durationMs: z.number().nullable(),
});

export const usageLimitKindSchema = z.enum(['session', 'week', 'other']);

export const usageLimitOutcomeSchema = z.enum(['continued', 'stopped']);

export const usageLimitEndSchema = z.object({ at: z.string(), outcome: usageLimitOutcomeSchema });

export const usageLimitItemSchema = z.object({
  kind: z.literal('usage-limit'),
  key: z.string(),
  limit: usageLimitKindSchema,
  stoppedAt: z.string(),
  continuesAt: z.string(),
  end: usageLimitEndSchema.nullable(),
});

export const retryOutcomeSchema = z.enum(['retried', 'stopped']);

export const retryEndSchema = z.object({ at: z.string(), outcome: retryOutcomeSchema });

// An attempt that stopped with an error, and when the next one started or was meant to.
export const retryItemSchema = z.object({
  kind: z.literal('retry'),
  key: z.string(),
  attempt: z.number(),
  attempts: z.number(),
  error: z.string(),
  stoppedAt: z.string(),
  continuesAt: z.string(),
  continuesSession: z.boolean(),
  end: retryEndSchema.nullable(),
});

export const transcriptItemSchema = z.discriminatedUnion('kind', [
  hookItemSchema,
  initItemSchema,
  modelFallbackItemSchema,
  textItemSchema,
  messageItemSchema,
  toolItemSchema,
  resultItemSchema,
  usageLimitItemSchema,
  retryItemSchema,
]);

export const transcriptSchema = z.object({
  eventCount: z.number(),
  items: z.array(transcriptItemSchema),
});
