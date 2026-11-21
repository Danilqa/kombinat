import { z } from 'zod';

import { agentNameSchema } from '../agent/schemas';
import { runIdSchema } from '../run/ids';
import { runRecordSchema, tokenUsageSchema } from '../run/schemas';
import { oneTimeRunSchema, skipSchema } from '../scheduler/schemas';
import { queuedWebhookSchema, webhookCallSchema } from '../webhook/schemas';
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
  worktree: z.boolean().default(false),
  maxBudgetUsd: z.number().nullable(),
  file: z.string(),
  running: z.boolean(),
  lastRun: runRecordSchema.nullable(),
  lastSkip: skipSchema.nullable(),
  // The last days' tokens. Older daemons do not send it, and tui --url may talk to one.
  tokenUsage: tokenUsageSchema.nullable().default(null),
});

export const routineDetailSchema = routineSummarySchema.extend({
  prompt: z.string(),
  skips: z.array(skipSchema),
  queue: z.array(queuedWebhookSchema),
  // Older daemons do not send it, and tui --url may talk to one.
  webhookCalls: z.array(webhookCallSchema).default([]),
  // Older daemons do not send it, and tui --url may talk to one.
  oneTimeRuns: z.array(oneTimeRunSchema).default([]),
});

export const startedRunSchema = z.object({ ok: z.literal(true) });

export const startedRunWithIdSchema = startedRunSchema.extend({ runId: runIdSchema });

export const startRunRequestSchema = z.object({ prompt: z.string().regex(/\S/) });

export const oneTimeRunRequestSchema = z.object({ at: z.iso.datetime({ offset: true }) });

export const changedOneTimeRunsSchema = z.object({ ok: z.literal(true) });
