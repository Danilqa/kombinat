import fs from 'node:fs';
import path from 'node:path';

import { isMatching } from 'ts-pattern';

import { routineIdSchema } from 'domains/id/schemas';
import type { RoutineId, RunId } from 'domains/id/types';
import { runRecordSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';

export function getRunsDir(routine: RoutineId): string {
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

export function readRunRecord(routine: RoutineId, id: RunId): RunRecord | null {
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
  if (!isMatching({ status: 'running' }, record) || checkIsProcessAlive(record.pid)) return record;
  const reconciled: RunRecord = {
    ...record,
    status: 'aborted',
    endedAt: new Date().toISOString(),
    error: 'Runner process disappeared',
  };
  writeRunRecord(reconciled);
  return reconciled;
}

export function listRuns(routine: RoutineId): RunRecord[] {
  const dir = getRunsDir(routine);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.json'))
    .flatMap(entry => {
      const record = readJsonFile(path.join(dir, entry), runRecordSchema);
      return record === null ? [] : [reconcileRecord(record)];
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function listAllRuns(): RunRecord[] {
  const root = path.join(config.stateDir, 'runs');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .flatMap(routine => listRuns(routineIdSchema.parse(routine)))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRunningRuns(): RunRecord[] {
  return listAllRuns().filter(isMatching({ status: 'running' }));
}
