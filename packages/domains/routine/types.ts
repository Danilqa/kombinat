import type { z } from 'zod';

import type {
  oneTimeRunRequestSchema,
  routineDetailSchema,
  routineSummarySchema,
  startRunRequestSchema,
} from './schemas';

export type RoutineSummary = z.infer<typeof routineSummarySchema>;
export type RoutineDetail = z.infer<typeof routineDetailSchema>;
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;
export type OneTimeRunRequest = z.infer<typeof oneTimeRunRequestSchema>;
