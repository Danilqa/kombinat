import { z } from 'zod';

export const routineNameSchema = z.string().brand<'RoutineName'>();

export type RoutineName = z.infer<typeof routineNameSchema>;
