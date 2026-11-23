import path from 'node:path';

import type { RoutineName } from 'domains/routine/ids';
import { queuedRunsFileSchema } from 'domains/run/schemas';
import type { QueuedRun } from 'domains/run/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { takePrompt } from './payload';
import { ensureStateDirs } from './storage';

export const QUEUED_RUNS_FILE = 'queued-runs.json';

const queuedRunsFile = () => path.join(config.stateDir, QUEUED_RUNS_FILE);

export function readQueuedRuns(): QueuedRun[] {
  return readJsonFile(queuedRunsFile(), queuedRunsFileSchema)?.runs ?? [];
}

export function writeQueuedRuns(runs: QueuedRun[]): void {
  ensureStateDirs();
  writeJsonFile(queuedRunsFile(), { runs });
}

export function listRoutineQueuedRuns(routine: RoutineName): QueuedRun[] {
  return readQueuedRuns().filter(run => run.routine === routine);
}

export function checkHasQueuedRuns(routine: RoutineName): boolean {
  return readQueuedRuns().some(run => run.routine === routine);
}

// A run that never starts must not leave its prompt behind.
export function dropQueuedRun(run: QueuedRun): void {
  takePrompt(run.routine, run.id);
}

export function cancelQueuedRuns(routine: RoutineName): void {
  const runs = readQueuedRuns();
  const cancelled = runs.filter(run => run.routine === routine);
  if (cancelled.length === 0) return;
  writeQueuedRuns(runs.filter(run => run.routine !== routine));
  for (const run of cancelled) dropQueuedRun(run);
}
