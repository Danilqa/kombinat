import type { HttpClient } from 'utils/http';

import type { RoutineName, RunId } from '../id/types';
import { transcriptSchema } from '../transcript/schemas';
import type { Transcript } from '../transcript/types';
import { runRecordSchema, runsPageSchema } from './schemas';
import type { RunRecord, RunsCursor, RunsPage, RunWithTranscript } from './types';

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
