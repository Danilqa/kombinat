import fs from 'node:fs';
import path from 'node:path';

import type { RunRecord } from 'domains/run/types';
import { findExpiredRuns } from 'domains/run/utils';
import { getErrorMessage } from 'utils/error';

import { readSettings } from '../settings/storage';
import { getRunsDir, listAllRuns } from './storage';

const CLEANUP_INTERVAL_MS = 3_600_000;

function deleteRun({ routine, id }: RunRecord): void {
  for (const extension of ['json', 'jsonl']) {
    fs.rmSync(path.join(getRunsDir(routine), `${id}.${extension}`), { force: true });
  }
}

export function deleteExpiredRuns(now = new Date()): RunRecord[] {
  const { runRetentionDays } = readSettings();
  if (runRetentionDays === null) return [];
  const expired = findExpiredRuns(listAllRuns(), runRetentionDays, now);
  expired.forEach(deleteRun);
  return expired;
}

export function startRunCleanup(log: (line: string) => void): () => void {
  const run = () => {
    try {
      const deleted = deleteExpiredRuns();
      if (deleted.length > 0) log(`deleted ${deleted.length} expired runs`);
    } catch (err) {
      log(`run cleanup failed: ${getErrorMessage(err)}`);
    }
  };
  run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  return () => clearInterval(timer);
}
