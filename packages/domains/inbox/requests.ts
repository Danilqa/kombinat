import type { HttpClient } from 'utils/http';

import type { RoutineName } from '../routine/ids';
import { changedNotifyLevelSchema, inboxSchema, markedReadSchema } from './schemas';
import type { Inbox, InboxRunKey, NotifyLevel } from './types';

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

export async function setNotifyLevel(
  http: HttpClient,
  routine: RoutineName,
  level: NotifyLevel,
): Promise<void> {
  await http.request(`/api/inbox/notify/${encodeURIComponent(routine)}`, changedNotifyLevelSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ level }),
  });
}
