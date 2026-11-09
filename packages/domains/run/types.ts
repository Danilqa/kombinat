import type { z } from 'zod';

import type { Transcript } from '../transcript/types';
import type {
  queuedWebhookSchema,
  runRecordSchema,
  runStatusSchema,
  runTriggerSchema,
} from './schemas';

export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunTrigger = z.infer<typeof runTriggerSchema>;
export type RunRecord = z.infer<typeof runRecordSchema>;
export type QueuedWebhook = z.infer<typeof queuedWebhookSchema>;

export interface RunWithTranscript {
  run: RunRecord;
  transcript: Transcript;
}
