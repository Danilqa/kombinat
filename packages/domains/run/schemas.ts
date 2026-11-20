import { z } from 'zod';

import { sessionIdSchema } from '../agent/ids';
import { agentNameSchema } from '../agent/schemas';
import { routineNameSchema } from '../routine/ids';
import { usageLimitKindSchema } from '../transcript/schemas';
import { runIdSchema } from './ids';

export const runStatusSchema = z.enum([
  'running',
  'waiting',
  'succeeded',
  'failed',
  'timed_out',
  'aborted',
]);

export const usageLimitWaitSchema = z.object({
  limit: usageLimitKindSchema,
  stoppedAt: z.string(),
  continuesAt: z.string(),
});

export const tokenCountsSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheWrite: z.number(),
  cacheRead: z.number(),
});

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
  // Records written before runs could be continued have no replyPid.
  replyPid: z.number().nullable().default(null),
  // Records written before webhooks could continue runs have no conversation.
  conversation: z.string().nullable().default(null),
  // Set while the run waits for a usage limit to reset. Older records have none.
  usageLimit: usageLimitWaitSchema.nullable().default(null),
  // Records written before runs saved their tokens have none.
  tokens: tokenCountsSchema.nullable().default(null),
});

export const tokenDaySchema = z.object({ date: z.string(), total: z.number() });

export const tokenUsageSchema = z.object({
  runs: z.number(),
  counts: tokenCountsSchema,
  days: z.array(tokenDaySchema),
  share: z.number(),
});

export const runMessageSchema = z.object({ text: z.string().trim().min(1) });

export const sentRunMessageSchema = z.object({ ok: z.literal(true) });

export const usageLimitWaitActionSchema = z.enum(['continue', 'stop']);

export const sentWaitActionSchema = z.object({ ok: z.literal(true) });

export const runsCursorSchema = z.string().brand<'RunsCursor'>();

export const runsCursorKeySchema = z.object({
  startedAt: z.string(),
  routine: routineNameSchema,
  id: runIdSchema,
});

export const runsPageSchema = z.object({
  runs: z.array(runRecordSchema),
  nextCursor: runsCursorSchema.nullable(),
  total: z.number(),
});
