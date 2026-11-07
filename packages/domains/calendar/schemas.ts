import { z } from 'zod';

import { runStatusSchema, runTriggerSchema } from '../run/schemas';

const calendarEntryBase = {
  id: z.string(),
  routine: z.string(),
  start: z.string(),
  end: z.string(),
  estimated: z.boolean(),
  overlaps: z.array(z.string()),
};

export const runCalendarEntrySchema = z.object({
  ...calendarEntryBase,
  kind: z.literal('run'),
  status: runStatusSchema,
  runId: z.string(),
  trigger: runTriggerSchema,
});

export const plannedCalendarEntrySchema = z.object({
  ...calendarEntryBase,
  kind: z.literal('planned'),
  status: z.null(),
  runId: z.null(),
  trigger: z.null(),
});

export const calendarEntrySchema = z.discriminatedUnion('kind', [
  runCalendarEntrySchema,
  plannedCalendarEntrySchema,
]);
