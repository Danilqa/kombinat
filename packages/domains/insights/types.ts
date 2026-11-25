import type { z } from 'zod';

import type {
  insightsDaySchema,
  insightsPeriodSchema,
  insightsRoutineSchema,
  insightsSchema,
  insightsTotalsSchema,
} from './schemas';

export type Insights = z.infer<typeof insightsSchema>;
export type InsightsDay = z.infer<typeof insightsDaySchema>;
export type InsightsPeriod = z.infer<typeof insightsPeriodSchema>;
export type InsightsRoutine = z.infer<typeof insightsRoutineSchema>;
export type InsightsTotals = z.infer<typeof insightsTotalsSchema>;
