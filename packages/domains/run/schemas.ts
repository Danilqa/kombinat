import { z } from 'zod';

import { agentNameSchema } from '../agent/schemas';
import { routineNameSchema, runIdSchema, sessionIdSchema } from '../id/schemas';

export const runStatusSchema = z.enum(['running', 'succeeded', 'failed', 'timed_out', 'aborted']);

export const runTriggerSchema = z.enum(['schedule', 'manual', 'catch_up', 'webhook']);

export const runRecordSchema = z.object({
  id: runIdSchema,
  routine: routineNameSchema,
  agent: agentNameSchema,
  trigger: runTriggerSchema,
  scheduledFor: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: runStatusSchema,
  pid: z.number().nullable(),
  exitCode: z.number().nullable(),
  sessionId: sessionIdSchema.nullable(),
  resumeCommand: z.string().nullable(),
  model: z.string().nullable(),
  costUsd: z.number().nullable(),
  numTurns: z.number().nullable(),
  durationMs: z.number().nullable(),
  resultText: z.string().nullable(),
  error: z.string().nullable(),
  logFile: z.string(),
});
