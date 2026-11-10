import { z } from 'zod';

export const routineNameSchema = z.string().brand<'RoutineName'>();

export const runIdSchema = z.string().brand<'RunId'>();

export const calendarEntryIdSchema = z.string().brand<'CalendarEntryId'>();

export const sessionIdSchema = z.string().brand<'SessionId'>();
