import { z } from 'zod';

import { routineNameSchema } from '../routine/ids';
import { runIdSchema } from '../run/ids';
import { runStatusSchema, runTriggerSchema } from '../run/schemas';
import { calendarEntryIdSchema } from './ids';

const calendarEntryBase = {
  id: calendarEntryIdSchema,
  routine: routineNameSchema,
  start: z.string(),
  end: z.string(),
  estimated: z.boolean(),
  overlaps: z.array(calendarEntryIdSchema),
};

export const runCalendarEntrySchema = z.object({
  ...calendarEntryBase,
  kind: z.literal('run'),
  status: runStatusSchema,
  runId: runIdSchema,
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
