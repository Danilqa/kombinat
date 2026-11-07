import fs from 'node:fs';
import path from 'node:path';

import { isMatching } from 'ts-pattern';
import type { z } from 'zod';

import { runRecordSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';
import { schedulerStateSchema } from 'domains/scheduler/schemas';
import type { SchedulerState } from 'domains/scheduler/types';

import { config } from './config';
import { parseJson } from './json';

function readJsonFile<T>(file: string, schema: z.ZodType<T>): T | null {
  if (!fs.existsSync(file)) return null;
  const parsed = schema.safeParse(parseJson(fs.readFileSync(file, 'utf8')));
  return parsed.success ? parsed.data : null;
}

export function getRunsDir(routine: string): string {
  return path.join(config.stateDir, 'runs', routine);
}

export function ensureStateDirs(): void {
  fs.mkdirSync(path.join(config.stateDir, 'runs'), { recursive: true });
}

export function writeRunRecord(record: RunRecord): void {
  const dir = getRunsDir(record.routine);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${record.id}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(record, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

export function readRunRecord(routine: string, id: string): RunRecord | null {
  return readJsonFile(path.join(getRunsDir(routine), `${id}.json`), runRecordSchema);
}

export function isProcessAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function reconcileRecord(record: RunRecord): RunRecord {
  if (!isMatching({ status: 'running' }, record) || isProcessAlive(record.pid)) return record;
  const reconciled: RunRecord = {
    ...record,
    status: 'aborted',
    endedAt: new Date().toISOString(),
    error: 'Runner process disappeared',
  };
  writeRunRecord(reconciled);
  return reconciled;
}

export function listRuns(routine: string): RunRecord[] {
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
    .flatMap(routine => listRuns(routine))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRunningRuns(): RunRecord[] {
  return listAllRuns().filter(isMatching({ status: 'running' }));
}

const schedulerFile = () => path.join(config.stateDir, 'scheduler.json');

export function readSchedulerState(): SchedulerState | null {
  return readJsonFile(schedulerFile(), schedulerStateSchema);
}

export function writeSchedulerState(state: SchedulerState): void {
  ensureStateDirs();
  fs.writeFileSync(`${schedulerFile()}.tmp`, JSON.stringify(state, null, 2));
  fs.renameSync(`${schedulerFile()}.tmp`, schedulerFile());
}
