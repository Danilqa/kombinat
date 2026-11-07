import type { z } from 'zod';

import type { routineDetailSchema, routineSummarySchema } from './schemas';

export type RoutineSummary = z.infer<typeof routineSummarySchema>;
export type RoutineDetail = z.infer<typeof routineDetailSchema>;
