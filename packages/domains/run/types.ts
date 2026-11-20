import type { z } from 'zod';

import type { RoutineName } from '../routine/ids';
import type { Transcript } from '../transcript/types';
import type {
  runRecordSchema,
  runsCursorKeySchema,
  runsCursorSchema,
  runsPageSchema,
  runStatusSchema,
  runTriggerSchema,
  usageLimitWaitActionSchema,
  usageLimitWaitSchema,
} from './schemas';

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunTrigger = z.infer<typeof runTriggerSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunsCursor = z.infer<typeof runsCursorSchema>;
export type RunsCursorKey = z.infer<typeof runsCursorKeySchema>;
export type RunsPage = z.infer<typeof runsPageSchema>;
export type UsageLimitWait = z.infer<typeof usageLimitWaitSchema>;
export type UsageLimitWaitAction = z.infer<typeof usageLimitWaitActionSchema>;

export interface RunsPageQuery {
  routine: RoutineName | null;
  cursor: RunsCursorKey | null;
  search: string | null;
}

export interface RunWithTranscript {
  run: RunRecord;
  transcript: Transcript;
}
