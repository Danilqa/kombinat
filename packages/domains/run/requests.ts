import type { HttpClient } from 'utils/http';

import type { RoutineName } from '../routine/ids';
import { transcriptSchema } from '../transcript/schemas';
import type { Transcript } from '../transcript/types';
import type { RunId } from './ids';
import {
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
  http: HttpClient,
  routine: RoutineName | null,
  cursor: RunsCursor | null,
): Promise<RunsPage> {
  const params = new URLSearchParams();
  if (routine !== null) params.set('routine', routine);
  if (cursor !== null) params.set('cursor', cursor);
  return http.request(`/api/runs?${params.toString()}`, runsPageSchema);
}

export async function searchRuns(http: HttpClient, search: string): Promise<RunsPage> {
  return http.request(`/api/runs?${new URLSearchParams({ q: search }).toString()}`, runsPageSchema);
}

export async function getRun(
  http: HttpClient,
  routine: RoutineName,
  id: RunId,
): Promise<RunRecord> {
  return http.request(getRunApiPath(routine, id), runRecordSchema);
}

export async function getRunTranscript(
  http: HttpClient,
  routine: RoutineName,
  id: RunId,
): Promise<Transcript> {
  return http.request(`${getRunApiPath(routine, id)}/transcript`, transcriptSchema);
}

export async function getRunWithTranscript(
  http: HttpClient,
  routine: RoutineName,
  id: RunId,
): Promise<RunWithTranscript> {
  const [run, transcript] = await Promise.all([
    getRun(http, routine, id),
    getRunTranscript(http, routine, id),
  ]);
  return { run, transcript };
}

export async function sendRunMessage(
  http: HttpClient,
  routine: RoutineName,
  id: RunId,
  text: string,
): Promise<void> {
  await http.request(`${getRunApiPath(routine, id)}/messages`, sentRunMessageSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function allowBlockedActions(
  http: HttpClient,
  routine: RoutineName,
  id: RunId,
): Promise<void> {
  await http.request(`${getRunApiPath(routine, id)}/blocked/allow`, sentRunMessageSchema, {
    method: 'POST',
  });
}

export async function sendWaitAction(
  http: HttpClient,
  routine: RoutineName,
  id: RunId,
  action: UsageLimitWaitAction,
): Promise<void> {
  await http.request(`${getRunApiPath(routine, id)}/wait/${action}`, sentWaitActionSchema, {
    method: 'POST',
  });
}
