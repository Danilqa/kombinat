import type { z } from 'zod';

import type {
  oneTimeRunSchema,
  schedulerStateSchema,
  skipReasonSchema,
  skipSchema,
} from './schemas';

export type SkipReason = z.infer<typeof skipReasonSchema>;
export type Skip = z.infer<typeof skipSchema>;
export type SchedulerState = z.infer<typeof schedulerStateSchema>;
export type OneTimeRun = z.infer<typeof oneTimeRunSchema>;

export interface RunLaterPreset {
  label: string;
  at: Date;
}
