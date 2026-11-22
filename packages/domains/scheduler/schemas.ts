import { z } from 'zod';

import { routineNameSchema } from '../routine/ids';

export const skipReasonSchema = z.enum([
  'already_running',
  'concurrency_limit',
  'disabled',
  'nothing_to_do',
]);

export const skipSchema = z.object({
  at: z.string(),
  scheduledFor: z.string(),
  reason: skipReasonSchema,
  // What the check printed when it found nothing to do. Older daemons do not send it.
  checkOutput: z.string().nullable().default(null),
});

export const schedulerStateSchema = z.object({
  startedAt: z.string(),
  lastTickAt: z.string(),
  routines: z.record(
    routineNameSchema,
    z.object({ lastScheduledFor: z.string().nullable(), skips: z.array(skipSchema) }),
  ),
});

export const oneTimeRunSchema = z.object({
  routine: routineNameSchema,
  at: z.string(),
});

export const oneTimeRunsFileSchema = z.object({ runs: z.array(oneTimeRunSchema) });
