import { z } from 'zod';

export const routineIdSchema = z.string().brand<'RoutineId'>();

export const runIdSchema = z.string().brand<'RunId'>();

export const calendarEntryIdSchema = z.string().brand<'CalendarEntryId'>();

export const sessionIdSchema = z.string().brand<'SessionId'>();
