import fs from 'node:fs';
import path from 'node:path';

import { isMatching } from 'ts-pattern';

import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import { runRecordSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';
import { checkIsRunActive, checkIsRunWaiting, compareRunsByNewest } from 'domains/run/utils';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { appendLogEvent } from './event-log';

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
    appendLogEvent(record, { type: 'reply_error', error: 'Reply process disappeared' });
    writeRunRecord(reconciled);
    return reconciled;
  }
  const hasRunner = isMatching({ status: 'running' }, record) || checkIsRunWaiting(record);
  if (!hasRunner || checkIsProcessAlive(record.pid)) return record;
  const endedAt = new Date().toISOString();
  const isRetrying = isMatching({ status: 'retrying' }, record);
  const reconciled: RunRecord = {
    ...record,
    status: 'aborted',
    endedAt,
    error: 'Runner process disappeared',
    usageLimit: null,
    // The attempt it waited for never started.
    retry: isRetrying ? null : record.retry,
  };
  if (record.usageLimit !== null) {
    appendLogEvent(record, { type: 'usage_limit_end', at: endedAt, outcome: 'stopped' });
  }
  if (isRetrying) {
    appendLogEvent(record, { type: 'retry_end', at: endedAt, outcome: 'stopped' });
  }
  writeRunRecord(reconciled);
  return reconciled;
}

function readRuns(routine: RoutineName, since: Date | null = null): RunRecord[] {
  const dir = getRunsDir(routine);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.json'))
    .flatMap(entry => {
      const file = path.join(dir, entry);
      if (since !== null && checkIsWrittenBefore(file, since)) return [];
      const record = readJsonFile(file, runRecordSchema);
      return record === null ? [] : [reconcileRecord(record)];
    });
}

// A record is first written when its run starts, so an older file holds a run that started earlier.
function checkIsWrittenBefore(file: string, since: Date): boolean {
  const mtimeMs = fs.statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0;
  return mtimeMs < since.getTime();
}

export function listRuns(routine: RoutineName): RunRecord[] {
  return readRuns(routine).sort(compareRunsByNewest);
}

export function listRunsSince(routine: RoutineName, since: Date): RunRecord[] {
  return readRuns(routine, since).sort(compareRunsByNewest);
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
