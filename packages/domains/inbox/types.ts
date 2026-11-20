import type { z } from 'zod';

import type { RunRecord } from '../run/types';
import type {
  inboxRunKeySchema,
  inboxSchema,
  inboxStateSchema,
  notifyLevelSchema,
  notifyLevelsSchema,
} from './schemas';

export type InboxRunKey = z.infer<typeof inboxRunKeySchema>;
export type InboxState = z.infer<typeof inboxStateSchema>;
export type Inbox = z.infer<typeof inboxSchema>;
export type NotifyLevel = z.infer<typeof notifyLevelSchema>;
export type NotifyLevels = z.infer<typeof notifyLevelsSchema>;

export type InboxGroup = 'needs_look' | 'findings' | 'quiet';

export interface InboxSection {
  group: InboxGroup;
  runs: RunRecord[];
}

export interface RunNotification {
  title: string;
  body: string;
  // A notification for several runs opens the Inbox instead of a run.
  run: RunRecord | null;
}
