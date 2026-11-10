import type { z } from 'zod';

import type {
  calendarEntryIdSchema,
  routineIdSchema,
  runIdSchema,
  sessionIdSchema,
} from './schemas';

export type RoutineId = z.infer<typeof routineIdSchema>;
export type RunId = z.infer<typeof runIdSchema>;
export type CalendarEntryId = z.infer<typeof calendarEntryIdSchema>;
export type SessionId = z.infer<typeof sessionIdSchema>;
