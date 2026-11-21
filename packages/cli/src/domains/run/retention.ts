import fs from 'node:fs';
import path from 'node:path';

import { isMatching } from 'ts-pattern';

import type { RunRecord } from 'domains/run/types';
import { findExpiredRuns } from 'domains/run/utils';
import { getErrorMessage } from 'utils/error';

import { readSettings } from '../settings/storage';
import { getRunsDir, listAllRuns } from './storage';
import { removeWorktree } from './worktree';

const CLEANUP_INTERVAL_MS = 3_600_000;

function deleteRun({ routine, id, worktree }: RunRecord): void {
  // The branch stays, and a worktree with changes that are not committed stays too.
  if (isMatching({ state: 'present' }, worktree)) {
    void removeWorktree(worktree).catch(() => undefined);
  }
  for (const extension of ['json', 'jsonl', 'wait']) {
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

interface Cleanup {
  items: string;
  deleteExpired: () => unknown[];
}

export function startCleanup(log: (line: string) => void, cleanups: Cleanup[]): () => void {
  const run = () => {
    for (const { items, deleteExpired } of cleanups) {
      try {
        const deleted = deleteExpired();
        if (deleted.length > 0) log(`deleted ${deleted.length} expired ${items}`);
      } catch (err) {
        log(`${items} cleanup failed: ${getErrorMessage(err)}`);
      }
    }
  };
  run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  return () => clearInterval(timer);
}
