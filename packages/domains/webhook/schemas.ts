import { z } from 'zod';

import { runIdSchema } from '../run/ids';
import { webhookCallIdSchema } from './ids';

export const queuedWebhookSchema = z.object({
  runId: runIdSchema,
  queuedAt: z.string(),
  bytes: z.number(),
  preview: z.string(),
});

export const webhookCallOutcomeSchema = z.enum([
  'started',
  'continued',
  'queued',
  'ignored',
  'rejected',
  'timed_out',
  'disabled',
  'queue_full',
]);

export const webhookCallSchema = z.object({
  id: webhookCallIdSchema,
  receivedAt: z.string(),
  outcome: webhookCallOutcomeSchema,
  status: z.number(),
  runId: runIdSchema.nullable(),
  reason: z.string().nullable(),
  bytes: z.number(),
  preview: z.string(),
});
