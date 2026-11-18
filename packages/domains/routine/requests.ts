import { z } from 'zod';

import type { HttpClient } from 'utils/http';

import type { RunId } from '../run/ids';
import type { RoutineName } from './ids';
import {
  routineDetailSchema,
  routineSummarySchema,
  startedRunSchema,
  startedRunWithIdSchema,
} from './schemas';
import type { RoutineDetail, RoutineSummary, StartRunRequest } from './types';

export async function getRoutines(http: HttpClient): Promise<RoutineSummary[]> {
  return http.request('/api/routines', z.array(routineSummarySchema));
}

export async function getRoutine(http: HttpClient, name: RoutineName): Promise<RoutineDetail> {
  return http.request(`/api/routines/${encodeURIComponent(name)}`, routineDetailSchema);
}

export async function startRoutineRun(http: HttpClient, name: RoutineName): Promise<void> {
  await http.request(`/api/routines/${encodeURIComponent(name)}/run`, startedRunSchema, {
    method: 'POST',
  });
}

export async function startRoutineRunWithPrompt(
  http: HttpClient,
  name: RoutineName,
  prompt: string,
): Promise<RunId> {
  const body: StartRunRequest = { prompt };
  const { runId } = await http.request(
    `/api/routines/${encodeURIComponent(name)}/run`,
    startedRunWithIdSchema,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  return runId;
}
