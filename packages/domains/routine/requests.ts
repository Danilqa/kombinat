import { z } from 'zod';

import type { HttpClient } from 'utils/http';

import type { RunId } from '../run/ids';
import type { RoutineName } from './ids';
import {
  addedRoutineSchema,
  cancelledQueuedRunsSchema,
  changedOneTimeRunsSchema,
  routineDetailSchema,
  routineSummarySchema,
  savedMemorySchema,
  startedRunSchema,
  startedRunWithIdSchema,
} from './schemas';
import type {
  AddRoutineRequest,
  AddedRoutine,
  MemoryRequest,
  OneTimeRunRequest,
  RoutineDetail,
  RoutineSummary,
  StartRunRequest,
} from './types';

export async function getRoutines(http: HttpClient): Promise<RoutineSummary[]> {
  return http.request('/api/routines', z.array(routineSummarySchema));
}

// Writes routines/<name>.md from the template, and never replaces a file that exists.
export async function addRoutine(http: HttpClient, body: AddRoutineRequest): Promise<AddedRoutine> {
  return http.request('/api/routines', addedRoutineSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getRoutine(http: HttpClient, name: RoutineName): Promise<RoutineDetail> {
  return http.request(`/api/routines/${encodeURIComponent(name)}`, routineDetailSchema);
}

// Without runs and maxParallel, the routine's own apply.
export async function startRoutineRun(
  http: HttpClient,
  name: RoutineName,
  body?: StartRunRequest,
): Promise<void> {
  await http.request(
    `/api/routines/${encodeURIComponent(name)}/run`,
    startedRunSchema,
    body === undefined
      ? { method: 'POST' }
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
}

export async function cancelQueuedRuns(http: HttpClient, name: RoutineName): Promise<void> {
  await http.request(
    `/api/routines/${encodeURIComponent(name)}/queued-runs/cancel`,
    cancelledQueuedRunsSchema,
    { method: 'POST' },
  );
}

export async function startRoutineRunWithPrompt(
  http: HttpClient,
  name: RoutineName,
  prompt: string,
): Promise<RunId> {
  // A prompt written for this run runs once, whatever number of runs the routine makes.
  const body: StartRunRequest = { prompt, runs: 1 };
  const { runId } = await http.request(
    `/api/routines/${encodeURIComponent(name)}/run`,
    startedRunWithIdSchema,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  return runId;
}

async function sendOneTimeRunRequest(http: HttpClient, path: string, at: string): Promise<void> {
  const body: OneTimeRunRequest = { at };
  await http.request(path, changedOneTimeRunsSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function scheduleOneTimeRun(
  http: HttpClient,
  name: RoutineName,
  at: string,
): Promise<void> {
  await sendOneTimeRunRequest(http, `/api/routines/${encodeURIComponent(name)}/one-time-runs`, at);
}

export async function cancelOneTimeRun(
  http: HttpClient,
  name: RoutineName,
  at: string,
): Promise<void> {
  await sendOneTimeRunRequest(
    http,
    `/api/routines/${encodeURIComponent(name)}/one-time-runs/cancel`,
    at,
  );
}

// Empty text clears the notes.
export async function saveRoutineMemory(
  http: HttpClient,
  name: RoutineName,
  text: string,
): Promise<void> {
  const body: MemoryRequest = { text };
  await http.request(`/api/routines/${encodeURIComponent(name)}/memory`, savedMemorySchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
