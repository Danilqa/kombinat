import type { z } from 'zod';

import type {
  calendarEntryIdSchema,
  routineNameSchema,
  runIdSchema,
  sessionIdSchema,
} from './schemas';

export type RoutineName = z.infer<typeof routineNameSchema>;
export type RunId = z.infer<typeof runIdSchema>;
export type CalendarEntryId = z.infer<typeof calendarEntryIdSchema>;
export type SessionId = z.infer<typeof sessionIdSchema>;
