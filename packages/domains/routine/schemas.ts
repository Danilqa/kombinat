import { z } from 'zod';

import { agentNameSchema } from '../agent/schemas';
import { runRecordSchema } from '../run/schemas';
import { skipSchema } from '../scheduler/schemas';

export const routineSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  schedule: z.string().nullable(),
  scheduleHuman: z.string(),
  nextRunAt: z.string().nullable(),
  enabled: z.boolean(),
  agent: agentNameSchema,
  model: z.string().nullable(),
  effort: z.string().nullable(),
  permissionMode: z.string().nullable(),
  command: z.string().nullable(),
  cwd: z.string(),
  timeoutMinutes: z.number(),
  maxBudgetUsd: z.number().nullable(),
  file: z.string(),
  running: z.boolean(),
  lastRun: runRecordSchema.nullable(),
  lastSkip: skipSchema.nullable(),
});

export const routineDetailSchema = routineSummarySchema.extend({
  prompt: z.string(),
  runs: z.array(runRecordSchema),
  skips: z.array(skipSchema),
});

export const startedRunSchema = z.object({ ok: z.literal(true) });
