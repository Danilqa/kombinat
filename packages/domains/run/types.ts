import type { z } from 'zod';

import type { RoutineName } from '../id/types';
import type { Transcript } from '../transcript/types';
import type {
  runRecordSchema,
  runsCursorKeySchema,
  runsCursorSchema,
  runsPageSchema,
  runStatusSchema,
  runTriggerSchema,
} from './schemas';

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunTrigger = z.infer<typeof runTriggerSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type RunsCursor = z.infer<typeof runsCursorSchema>;
export type RunsCursorKey = z.infer<typeof runsCursorKeySchema>;
export type RunsPage = z.infer<typeof runsPageSchema>;

export interface RunsPageQuery {
  routine: RoutineName | null;
  cursor: RunsCursorKey | null;
  limit: number;
}

export interface RunWithTranscript {
  run: RunRecord;
  transcript: Transcript;
}
