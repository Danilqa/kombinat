import { z } from 'zod';

export const calendarEntryIdSchema = z.string().brand<'CalendarEntryId'>();

export type CalendarEntryId = z.infer<typeof calendarEntryIdSchema>;
