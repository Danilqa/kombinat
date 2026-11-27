import type { Api } from 'utils/api';

import type { RoutineName } from '../routine/ids';
import { transcriptSchema } from '../transcript/schemas';
import type { Transcript } from '../transcript/types';
import type { RunId } from './ids';
import {
  removedWorktreeSchema,
  runRecordSchema,
  runsPageSchema,
  sentRunMessageSchema,
  sentWaitActionSchema,
} from './schemas';
import type {
  RunRecord,
  RunsCursor,
  RunsPage,
  RunWithTranscript,
  UsageLimitWaitAction,
} from './types';

function getRunApiPath(routine: RoutineName, id: RunId): string {
  return `/api/runs/${encodeURIComponent(routine)}/${encodeURIComponent(id)}`;
}

export async function getRunsPage(
  api: Api,
  routine: RoutineName | null,
  cursor: RunsCursor | null,
): Promise<RunsPage> {
  return api
    .get('/api/runs', {
      searchParams: { routine: routine ?? undefined, cursor: cursor ?? undefined },
    })
    .json(runsPageSchema);
}

export async function searchRuns(api: Api, search: string): Promise<RunsPage> {
  return api.get('/api/runs', { searchParams: { q: search } }).json(runsPageSchema);
}

export async function getRun(api: Api, routine: RoutineName, id: RunId): Promise<RunRecord> {
  return api.get(getRunApiPath(routine, id)).json(runRecordSchema);
}

export async function getRunTranscript(
  api: Api,
  routine: RoutineName,
  id: RunId,
): Promise<Transcript> {
  return api.get(`${getRunApiPath(routine, id)}/transcript`).json(transcriptSchema);
}

export async function getRunWithTranscript(
  api: Api,
  routine: RoutineName,
  id: RunId,
): Promise<RunWithTranscript> {
  const [run, transcript] = await Promise.all([
    getRun(api, routine, id),
    getRunTranscript(api, routine, id),
  ]);
  return { run, transcript };
}

export async function sendRunMessage(
  api: Api,
  routine: RoutineName,
  id: RunId,
  text: string,
): Promise<void> {
  await api
    .post(`${getRunApiPath(routine, id)}/messages`, { json: { text } })
    .json(sentRunMessageSchema);
}

export async function allowBlockedActions(
  api: Api,
  routine: RoutineName,
  id: RunId,
): Promise<void> {
  await api.post(`${getRunApiPath(routine, id)}/blocked/allow`).json(sentRunMessageSchema);
}

export async function sendWaitAction(
  api: Api,
  routine: RoutineName,
  id: RunId,
  action: UsageLimitWaitAction,
): Promise<void> {
  await api.post(`${getRunApiPath(routine, id)}/wait/${action}`).json(sentWaitActionSchema);
}

export async function removeRunWorktree(api: Api, routine: RoutineName, id: RunId): Promise<void> {
  await api.post(`${getRunApiPath(routine, id)}/worktree/remove`).json(removedWorktreeSchema);
}
