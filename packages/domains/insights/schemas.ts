import { z } from 'zod';

import { routineNameSchema } from '../routine/ids';
import { INSIGHTS_PERIODS } from './constants';

export const insightsPeriodSchema = z.literal(INSIGHTS_PERIODS);

export const insightsTotalsSchema = z.object({
  runs: z.number(),
  // Runs that are still at work or waiting are neither finished nor failed.
  finished: z.number(),
  failed: z.number(),
  tokens: z.number(),
  averageRunMs: z.number().nullable(),
});

export const insightsDaySchema = z.object({
  date: z.string(),
  runs: z.number(),
  failed: z.number(),
  tokens: z.number(),
});

export const insightsRoutineSchema = z.object({
  routine: routineNameSchema,
  ...insightsTotalsSchema.shape,
  // null when none of its runs reported tokens, such as for a command.
  tokens: z.number().nullable(),
  share: z.number(),
});

export const insightsSchema = z.object({
  days: insightsPeriodSchema,
  retentionDays: z.number().nullable(),
  current: insightsTotalsSchema,
  // null when the run retention has deleted the runs of the days before the period.
  previous: insightsTotalsSchema.nullable(),
  daily: z.array(insightsDaySchema),
  routines: z.array(insightsRoutineSchema),
});
