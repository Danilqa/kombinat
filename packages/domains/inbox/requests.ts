import type { HttpClient } from 'utils/http';

import { inboxSchema, markedReadSchema } from './schemas';
import type { Inbox, InboxRunKey } from './types';

export async function getInbox(http: HttpClient): Promise<Inbox> {
  return http.request('/api/inbox', inboxSchema);
}

export async function markRunsRead(http: HttpClient, runs: InboxRunKey[]): Promise<void> {
  await http.request('/api/inbox/read', markedReadSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runs }),
  });
}
