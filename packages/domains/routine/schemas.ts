import { z } from 'zod';

import { agentNameSchema } from '../agent/schemas';
import { MAX_RUNS } from '../run/constants';
import { runIdSchema } from '../run/ids';
import { queuedRunSchema, runRecordSchema, tokenUsageSchema } from '../run/schemas';
import { oneTimeRunSchema, skipSchema } from '../scheduler/schemas';
import { queuedWebhookSchema, webhookCallSchema } from '../webhook/schemas';
import { MEMORY_MAX_LENGTH } from './constants';
import { routineNameSchema } from './ids';

export const routineSummarySchema = z.object({
  name: routineNameSchema,
  description: z.string(),
  schedule: z.string().nullable(),
  scheduleHuman: z.string(),
  nextRunAt: z.string().nullable(),
  enabled: z.boolean(),
  webhook: z.boolean(),
  webhookGate: z.string().nullable(),
  // Older daemons do not send it, and tui --url may talk to one.
  check: z.string().nullable().default(null),
  queuedWebhooks: z.number(),
  agent: agentNameSchema,
  model: z.string().nullable(),
  // Older daemons do not send it, and tui --url may talk to one.
  fallbackModel: z.string().nullable().optional(),
  effort: z.string().nullable(),
  permissionMode: z.string().nullable(),
  command: z.string().nullable(),
  cwd: z.string(),
  timeoutMinutes: z.number(),
  // Older daemons do not send it, and tui --url may talk to one.
  retries: z.number().default(0),
  // How many runs each start makes, and how many of them work at once. Older daemons do not send them.
  runs: z.number().default(1),
  maxParallel: z.number().default(1),
  // Older daemons do not send it, and tui --url may talk to one.
  worktree: z.boolean().default(false),
  maxBudgetUsd: z.number().nullable(),
  // Older daemons do not send it, and tui --url may talk to one.
  maxBudgetTokens: z.number().nullable().default(null),
  file: z.string(),
  running: z.boolean(),
  lastRun: runRecordSchema.nullable(),
  lastSkip: skipSchema.nullable(),
  // The last days' tokens. Older daemons do not send it, and tui --url may talk to one.
  tokenUsage: tokenUsageSchema.nullable().default(null),
  // Older daemons do not send it, and tui --url may talk to one.
  memory: z.boolean().default(false),
});

export const memoryAuthorSchema = z.enum(['run', 'user']);

export const memoryChangeSchema = z.object({
  at: z.string(),
  by: memoryAuthorSchema,
  runId: runIdSchema.nullable(),
  // A change made in an editor outside kombinat has no counts.
  added: z.number().nullable(),
  removed: z.number().nullable(),
});

export const routineMemorySchema = z.object({
  text: z.string(),
  file: z.string(),
  change: memoryChangeSchema.nullable(),
});

export const routineDetailSchema = routineSummarySchema.extend({
  prompt: z.string(),
  skips: z.array(skipSchema),
  queue: z.array(queuedWebhookSchema),
  // Older daemons do not send it, and tui --url may talk to one.
  webhookCalls: z.array(webhookCallSchema).default([]),
  // Older daemons do not send it, and tui --url may talk to one.
  oneTimeRuns: z.array(oneTimeRunSchema).default([]),
  // Older daemons do not send it, and tui --url may talk to one.
  queuedRuns: z.array(queuedRunSchema).default([]),
  // null when the routine has no memory. Older daemons do not send it.
  memoryNotes: routineMemorySchema.nullable().default(null),
});

export const startedRunSchema = z.object({ ok: z.literal(true) });

export const startedRunWithIdSchema = startedRunSchema.extend({ runId: runIdSchema });

const runCountSchema = z.int().min(1).max(MAX_RUNS);

// Without runs and maxParallel, the routine's own apply.
export const startRunRequestSchema = z.object({
  prompt: z.string().regex(/\S/).optional(),
  runs: runCountSchema.optional(),
  maxParallel: runCountSchema.optional(),
});

export const oneTimeRunRequestSchema = z.object({ at: z.iso.datetime({ offset: true }) });

export const cancelledQueuedRunsSchema = z.object({ ok: z.literal(true) });

export const changedOneTimeRunsSchema = z.object({ ok: z.literal(true) });

export const memoryRequestSchema = z.object({ text: z.string().max(MEMORY_MAX_LENGTH) });

export const savedMemorySchema = z.object({ ok: z.literal(true) });
