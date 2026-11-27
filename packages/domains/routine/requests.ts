import { z } from 'zod';

import type { Api } from 'utils/api';

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

function getRoutineApiPath(name: RoutineName): string {
  return `/api/routines/${encodeURIComponent(name)}`;
}

export async function getRoutines(api: Api): Promise<RoutineSummary[]> {
  return api.get('/api/routines').json(z.array(routineSummarySchema));
}

// Writes routines/<name>.md from the template, and never replaces a file that exists.
export async function addRoutine(api: Api, body: AddRoutineRequest): Promise<AddedRoutine> {
  return api.post('/api/routines', { json: body }).json(addedRoutineSchema);
}

export async function getRoutine(api: Api, name: RoutineName): Promise<RoutineDetail> {
  return api.get(getRoutineApiPath(name)).json(routineDetailSchema);
}

// Without runs and maxParallel, the routine's own apply.
export async function startRoutineRun(
  api: Api,
  name: RoutineName,
  body?: StartRunRequest,
): Promise<void> {
  await api.post(`${getRoutineApiPath(name)}/run`, { json: body }).json(startedRunSchema);
}

export async function cancelQueuedRuns(api: Api, name: RoutineName): Promise<void> {
  await api.post(`${getRoutineApiPath(name)}/queued-runs/cancel`).json(cancelledQueuedRunsSchema);
}

export async function startRoutineRunWithPrompt(
  api: Api,
  name: RoutineName,
  prompt: string,
): Promise<RunId> {
  // A prompt written for this run runs once, whatever number of runs the routine makes.
  const body: StartRunRequest = { prompt, runs: 1 };
  const { runId } = await api
    .post(`${getRoutineApiPath(name)}/run`, { json: body })
    .json(startedRunWithIdSchema);
  return runId;
}

export async function scheduleOneTimeRun(api: Api, name: RoutineName, at: string): Promise<void> {
  const body: OneTimeRunRequest = { at };
  await api
    .post(`${getRoutineApiPath(name)}/one-time-runs`, { json: body })
    .json(changedOneTimeRunsSchema);
}

export async function cancelOneTimeRun(api: Api, name: RoutineName, at: string): Promise<void> {
  const body: OneTimeRunRequest = { at };
  await api
    .post(`${getRoutineApiPath(name)}/one-time-runs/cancel`, { json: body })
    .json(changedOneTimeRunsSchema);
}

// Empty text clears the notes.
export async function saveRoutineMemory(api: Api, name: RoutineName, text: string): Promise<void> {
  const body: MemoryRequest = { text };
  await api.put(`${getRoutineApiPath(name)}/memory`, { json: body }).json(savedMemorySchema);
}
