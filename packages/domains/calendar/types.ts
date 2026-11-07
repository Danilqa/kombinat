import type { z } from 'zod';

import type {
  calendarEntrySchema,
  plannedCalendarEntrySchema,
  runCalendarEntrySchema,
} from './schemas';

export type CalendarEntry = z.infer<typeof calendarEntrySchema>;
export type RunCalendarEntry = z.infer<typeof runCalendarEntrySchema>;
export type PlannedCalendarEntry = z.infer<typeof plannedCalendarEntrySchema>;
