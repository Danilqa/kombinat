import { z } from 'zod';

export const toolResultSchema = z.object({ content: z.string(), isError: z.boolean() });

export const hookPhaseSchema = z.enum(['before', 'after']);

export const hookItemSchema = z.object({
  kind: z.literal('hook'),
  key: z.string(),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
  // Older daemons do not send it, and tui --url may talk to one.
  phase: hookPhaseSchema.default('before'),
});

export const initItemSchema = z.object({
  kind: z.literal('init'),
  key: z.string(),
  model: z.string().nullable(),
  cwd: z.string().nullable(),
  toolCount: z.number().nullable(),
  permissionMode: z.string().nullable(),
});

export const textItemSchema = z.object({
  kind: z.literal('text'),
  key: z.string(),
  text: z.string(),
  isSubagent: z.boolean(),
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

export const transcriptItemSchema = z.discriminatedUnion('kind', [
  hookItemSchema,
  initItemSchema,
  textItemSchema,
  toolItemSchema,
  resultItemSchema,
]);

export const transcriptSchema = z.object({
  eventCount: z.number(),
  items: z.array(transcriptItemSchema),
});
