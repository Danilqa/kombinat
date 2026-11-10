import type { z } from 'zod';

import type { RoutineId } from '../id/types';
import type {
  calendarEntrySchema,
  plannedCalendarEntrySchema,
  runCalendarEntrySchema,
} from './schemas';

export type CalendarEntry = z.infer<typeof calendarEntrySchema>;
export type RunCalendarEntry = z.infer<typeof runCalendarEntrySchema>;
export type PlannedCalendarEntry = z.infer<typeof plannedCalendarEntrySchema>;

export interface ScheduledRoutine {
  name: RoutineId;
  schedule: string | null;
  enabled: boolean;
  timeoutMinutes: number;
}

export interface PlannedLength {
  minutes: number;
  estimated: boolean;
}
