import path from 'node:path';

import type { RoutineName } from 'domains/routine/ids';
import { oneTimeRunsFileSchema, schedulerStateSchema } from 'domains/scheduler/schemas';
import type { OneTimeRun, SchedulerState, Skip } from 'domains/scheduler/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

export const ONE_TIME_RUNS_FILE = 'one-time-runs.json';

const schedulerFile = () => path.join(config.stateDir, 'scheduler.json');
const oneTimeRunsFile = () => path.join(config.stateDir, ONE_TIME_RUNS_FILE);

export function readSchedulerState(): SchedulerState | null {
  return readJsonFile(schedulerFile(), schedulerStateSchema);
}

export function writeSchedulerState(state: SchedulerState): void {
  writeJsonFile(schedulerFile(), state);
}

export function getSkips(routine: RoutineName): Skip[] {
  return readSchedulerState()?.routines[routine]?.skips ?? [];
}

export function readOneTimeRuns(): OneTimeRun[] {
  return readJsonFile(oneTimeRunsFile(), oneTimeRunsFileSchema)?.runs ?? [];
}

export function writeOneTimeRuns(runs: OneTimeRun[]): void {
  writeJsonFile(oneTimeRunsFile(), { runs });
}
