import fs from 'node:fs';
import path from 'node:path';

import { isMatching, P } from 'ts-pattern';

import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import { runRecordSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';
import { checkIsRunActive, compareRunsByNewest } from 'domains/run/utils';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { appendChatEvent, appendUsageLimitEvent } from './event-log';

export function getRunsDir(routine: RoutineName): string {
  return path.join(config.stateDir, 'runs', routine);
}

export function ensureStateDirs(): void {
  fs.mkdirSync(path.join(config.stateDir, 'runs'), { recursive: true });
}

export function writeRunRecord(record: RunRecord): void {
  const dir = getRunsDir(record.routine);
  fs.mkdirSync(dir, { recursive: true });
  writeJsonFile(path.join(dir, `${record.id}.json`), record);
}

export function readRunRecord(routine: RoutineName, id: RunId): RunRecord | null {
  return readJsonFile(path.join(getRunsDir(routine), `${id}.json`), runRecordSchema);
}

export function checkIsProcessAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function reconcileRecord(record: RunRecord): RunRecord {
  if (record.replyPid !== null && !checkIsProcessAlive(record.replyPid)) {
    const reconciled: RunRecord = { ...record, replyPid: null };
    appendChatEvent(record, { type: 'reply_error', error: 'Reply process disappeared' });
    writeRunRecord(reconciled);
    return reconciled;
  }
  const isAtWork = isMatching({ status: P.union('running', 'waiting') }, record);
  if (!isAtWork || checkIsProcessAlive(record.pid)) return record;
  const endedAt = new Date().toISOString();
  const reconciled: RunRecord = {
    ...record,
    status: 'aborted',
    endedAt,
    error: 'Runner process disappeared',
    usageLimit: null,
  };
  if (record.usageLimit !== null) {
    appendUsageLimitEvent(record, { type: 'usage_limit_end', at: endedAt, outcome: 'stopped' });
  }
  writeRunRecord(reconciled);
  return reconciled;
}

function readRuns(routine: RoutineName): RunRecord[] {
  const dir = getRunsDir(routine);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.json'))
    .flatMap(entry => {
      const record = readJsonFile(path.join(dir, entry), runRecordSchema);
      return record === null ? [] : [reconcileRecord(record)];
    });
}

export function listRuns(routine: RoutineName): RunRecord[] {
  return readRuns(routine).sort(compareRunsByNewest);
}

export function listAllRuns(): RunRecord[] {
  const root = path.join(config.stateDir, 'runs');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .flatMap(routine => readRuns(routineNameSchema.parse(routine)))
    .sort(compareRunsByNewest);
}

export function getRunningRuns(): RunRecord[] {
  return listAllRuns().filter(checkIsRunActive);
}
