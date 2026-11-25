import { z } from 'zod';

export const routineNameSchema = z.string().brand<'RoutineName'>();

export type RoutineName = z.infer<typeof routineNameSchema>;

export const routineTemplateIdSchema = z.string().brand<'RoutineTemplateId'>();

export type RoutineTemplateId = z.infer<typeof routineTemplateIdSchema>;
