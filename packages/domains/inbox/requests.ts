import type { Api } from 'utils/api';

import type { RoutineName } from '../routine/ids';
import { changedNotifyLevelSchema, inboxSchema, markedReadSchema } from './schemas';
import type { Inbox, InboxRunKey, NotifyLevel } from './types';

export async function getInbox(api: Api): Promise<Inbox> {
  return api.get('/api/inbox').json(inboxSchema);
}

export async function markRunsRead(api: Api, runs: InboxRunKey[]): Promise<void> {
  await api.post('/api/inbox/read', { json: { runs } }).json(markedReadSchema);
}

export async function setNotifyLevel(
  api: Api,
  routine: RoutineName,
  level: NotifyLevel,
): Promise<void> {
  await api
    .put(`/api/inbox/notify/${encodeURIComponent(routine)}`, { json: { level } })
    .json(changedNotifyLevelSchema);
}
