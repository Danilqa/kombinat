import path from 'node:path';

import type { RoutineName } from 'domains/id/types';
import { schedulerStateSchema } from 'domains/scheduler/schemas';
import type { SchedulerState, Skip } from 'domains/scheduler/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { ensureStateDirs } from '../run/storage';

const schedulerFile = () => path.join(config.stateDir, 'scheduler.json');

export function readSchedulerState(): SchedulerState | null {
  return readJsonFile(schedulerFile(), schedulerStateSchema);
}

export function writeSchedulerState(state: SchedulerState): void {
  ensureStateDirs();
  writeJsonFile(schedulerFile(), state);
}

export function getSkips(routine: RoutineName): Skip[] {
  return readSchedulerState()?.routines[routine]?.skips ?? [];
}
