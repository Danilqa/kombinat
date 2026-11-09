import { z } from 'zod';

import { agentNameSchema } from '../agent/schemas';

export const runStatusSchema = z.enum(['running', 'succeeded', 'failed', 'timed_out', 'aborted']);

export const runTriggerSchema = z.enum(['schedule', 'manual', 'catch_up', 'webhook']);

export const runRecordSchema = z.object({
  id: z.string(),
  routine: z.string(),
  agent: agentNameSchema,
  trigger: runTriggerSchema,
  scheduledFor: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: runStatusSchema,
  pid: z.number().nullable(),
  exitCode: z.number().nullable(),
  sessionId: z.string().nullable(),
  resumeCommand: z.string().nullable(),
  model: z.string().nullable(),
  costUsd: z.number().nullable(),
  numTurns: z.number().nullable(),
  durationMs: z.number().nullable(),
  resultText: z.string().nullable(),
  error: z.string().nullable(),
  logFile: z.string(),
});

export const queuedWebhookSchema = z.object({
  runId: z.string(),
  queuedAt: z.string(),
  bytes: z.number(),
  preview: z.string(),
});
