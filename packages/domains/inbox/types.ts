import type { z } from 'zod';

import type { RunRecord } from '../run/types';
import type { inboxRunKeySchema, inboxSchema, inboxStateSchema } from './schemas';

export type InboxRunKey = z.infer<typeof inboxRunKeySchema>;
export type InboxState = z.infer<typeof inboxStateSchema>;
export type Inbox = z.infer<typeof inboxSchema>;

export type InboxGroup = 'needs_look' | 'findings' | 'quiet';

export interface InboxSection {
  group: InboxGroup;
  runs: RunRecord[];
}
