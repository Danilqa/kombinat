import { z } from 'zod';

import type { HttpClient } from 'utils/http';

import type { RoutineId, RunId } from '../id/types';
import { transcriptSchema } from '../transcript/schemas';
import type { Transcript } from '../transcript/types';
import { runRecordSchema } from './schemas';
import type { RunRecord, RunWithTranscript } from './types';

function getRunApiPath(routine: RoutineId, id: RunId): string {
  return `/api/runs/${encodeURIComponent(routine)}/${encodeURIComponent(id)}`;
}

export async function getRuns(http: HttpClient, limit: number): Promise<RunRecord[]> {
  return http.request(`/api/runs?limit=${limit}`, z.array(runRecordSchema));
}

export async function getRun(http: HttpClient, routine: RoutineId, id: RunId): Promise<RunRecord> {
  return http.request(getRunApiPath(routine, id), runRecordSchema);
}

export async function getRunTranscript(
  http: HttpClient,
  routine: RoutineId,
  id: RunId,
): Promise<Transcript> {
  return http.request(`${getRunApiPath(routine, id)}/transcript`, transcriptSchema);
}

export async function getRunWithTranscript(
  http: HttpClient,
  routine: RoutineId,
  id: RunId,
): Promise<RunWithTranscript> {
  const [run, transcript] = await Promise.all([
    getRun(http, routine, id),
    getRunTranscript(http, routine, id),
  ]);
  return { run, transcript };
}
