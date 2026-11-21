import type { z } from 'zod';

import type {
  memoryAuthorSchema,
  memoryChangeSchema,
  memoryRequestSchema,
  oneTimeRunRequestSchema,
  routineDetailSchema,
  routineMemorySchema,
  routineSummarySchema,
  startRunRequestSchema,
} from './schemas';

export type RoutineSummary = z.infer<typeof routineSummarySchema>;
export type RoutineDetail = z.infer<typeof routineDetailSchema>;
export type StartRunRequest = z.infer<typeof startRunRequestSchema>;
export type OneTimeRunRequest = z.infer<typeof oneTimeRunRequestSchema>;
export type MemoryAuthor = z.infer<typeof memoryAuthorSchema>;
export type MemoryChange = z.infer<typeof memoryChangeSchema>;
export type RoutineMemory = z.infer<typeof routineMemorySchema>;
export type MemoryRequest = z.infer<typeof memoryRequestSchema>;
