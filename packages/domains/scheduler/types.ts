import type { z } from 'zod';

import type { schedulerStateSchema, skipReasonSchema, skipSchema } from './schemas';

export type SkipReason = z.infer<typeof skipReasonSchema>;
export type Skip = z.infer<typeof skipSchema>;
export type SchedulerState = z.infer<typeof schedulerStateSchema>;
