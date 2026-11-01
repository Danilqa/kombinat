import fs from 'node:fs';
import path from 'node:path';
import type { AgentName } from './agents/types';
import { config } from './config';

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'timed_out' | 'aborted';
export type RunTrigger = 'schedule' | 'manual' | 'catch_up';

export interface RunRecord {
  id: string;
  routine: string;
  agent: AgentName;
  trigger: RunTrigger;
  scheduledFor: string | null;
  startedAt: string;
  endedAt: string | null;
  status: RunStatus;
  pid: number | null;
  exitCode: number | null;
  sessionId: string | null;
  resumeCommand: string | null;
  model: string | null;
  costUsd: number | null;
  numTurns: number | null;
  durationMs: number | null;
  resultText: string | null;
  error: string | null;
  logFile: string;
}

export type SkipReason = 'already_running' | 'concurrency_limit' | 'disabled';

export interface Skip {
  at: string;
  scheduledFor: string;
  reason: SkipReason;
}

export interface RoutineSchedule {
  lastScheduledFor: string | null;
  skips: Skip[];
}

export interface SchedulerState {
  startedAt: string;
  lastTickAt: string;
  routines: Record<string, RoutineSchedule>;
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
  const file = path.join(getRunsDir(routine), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RunRecord;
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
  if (record.status !== 'running' || isProcessAlive(record.pid)) return record;
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
    .filter(f => f.endsWith('.json'))
    .map(f => reconcileRecord(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as RunRecord))
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
  return listAllRuns().filter(r => r.status === 'running');
}

const schedulerFile = () => path.join(config.stateDir, 'scheduler.json');

export function readSchedulerState(): SchedulerState | null {
  if (!fs.existsSync(schedulerFile())) return null;
  return JSON.parse(fs.readFileSync(schedulerFile(), 'utf8')) as SchedulerState;
}

export function writeSchedulerState(state: SchedulerState): void {
  ensureStateDirs();
  fs.writeFileSync(`${schedulerFile()}.tmp`, JSON.stringify(state, null, 2));
  fs.renameSync(`${schedulerFile()}.tmp`, schedulerFile());
}

export function createRunId(now = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${suffix}`;
}
