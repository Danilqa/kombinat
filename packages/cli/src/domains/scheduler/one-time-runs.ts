import path from 'node:path';

import { oneTimeRunsFileSchema } from 'domains/scheduler/schemas';
import type { OneTimeRun } from 'domains/scheduler/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { ensureStateDirs } from '../run/storage';

export const ONE_TIME_RUNS_FILE = 'one-time-runs.json';

const oneTimeRunsFile = () => path.join(config.stateDir, ONE_TIME_RUNS_FILE);

export function readOneTimeRuns(): OneTimeRun[] {
  return readJsonFile(oneTimeRunsFile(), oneTimeRunsFileSchema)?.runs ?? [];
}

export function writeOneTimeRuns(runs: OneTimeRun[]): void {
  ensureStateDirs();
  writeJsonFile(oneTimeRunsFile(), { runs });
}
