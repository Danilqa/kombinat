import { spawn } from 'node:child_process';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';
import { checkIsRunActive, createRunId } from 'domains/run/utils';

import { config, getCliArgs } from '../../config';
import type { ChatMessage } from './event-log';
import { appendLogEvent } from './event-log';
import { HOOK_TIMEOUT_MS } from './hooks';
import { writePrompt } from './payload';
import { checkHasQueuedRuns, readQueuedRuns, writeQueuedRuns } from './queued-runs';
import type { RunOptions } from './runner';
import { listRuns, readRunRecord, writeRunRecord } from './storage';

const PENDING_START_MS = HOOK_TIMEOUT_MS + 60_000;

interface PendingStart {
  routine: RoutineName;
  startedAt: number;
  conversation: string | null;
}

// Until a run writes its record, only this process knows it started.
const pendingStarts = new Map<RunId, PendingStart>();

function listStartingRuns(routineName: RoutineName, now = Date.now()): RunId[] {
  const runIds: RunId[] = [];
  for (const [runId, pending] of pendingStarts) {
    if (pending.routine !== routineName) continue;
    const isWaiting =
      now - pending.startedAt < PENDING_START_MS && readRunRecord(routineName, runId) === null;
    if (isWaiting) runIds.push(runId);
    else pendingStarts.delete(runId);
  }
  return runIds;
}

export function countStartingRuns(routineName: RoutineName, now = Date.now()): number {
  return listStartingRuns(routineName, now).length;
}

export function checkIsStarting(routineName: RoutineName, now = Date.now()): boolean {
  return countStartingRuns(routineName, now) > 0;
}

export function findStartingConversationRun(
  routineName: RoutineName,
  conversation: string,
): RunId | null {
  return (
    listStartingRuns(routineName).find(
      runId => pendingStarts.get(runId)?.conversation === conversation,
    ) ?? null
  );
}

// Its queued runs keep a routine running between the runs of one start.
export function checkIsRunning(routineName: RoutineName): boolean {
  return (
    checkIsStarting(routineName) ||
    checkHasQueuedRuns(routineName) ||
    listRuns(routineName).some(checkIsRunActive)
  );
}

export function startDetachedRun(routineName: RoutineName, options: RunOptions): RunId {
  const runId = options.runId ?? createRunId();
  const args = getCliArgs('run', routineName, '--trigger', options.trigger, '--run-id', runId);
  if (options.scheduledFor) args.push('--scheduled-for', options.scheduledFor);
  // With =, a key that starts with a dash is still the value.
  if (options.conversation) args.push(`--conversation=${options.conversation}`);
  pendingStarts.set(runId, {
    routine: routineName,
    startedAt: Date.now(),
    conversation: options.conversation ?? null,
  });
  spawn(process.execPath, args, {
    cwd: config.projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  }).unref();
  return runId;
}

export interface RunBatch {
  count: number;
  maxParallel: number;
  prompt?: string | null;
}

// Starts the first run and queues the others, which the scheduler starts as slots free up.
export function startDetachedRuns(
  routineName: RoutineName,
  options: RunOptions,
  { count, maxParallel, prompt = null }: RunBatch,
): RunId {
  const firstId = options.runId ?? createRunId();
  const queuedIds = Array.from({ length: count - 1 }, () => createRunId());
  if (prompt !== null) {
    for (const runId of [firstId, ...queuedIds]) writePrompt(routineName, runId, prompt);
  }
  if (queuedIds.length > 0) {
    const queuedAt = new Date().toISOString();
    writeQueuedRuns([
      ...readQueuedRuns(),
      ...queuedIds.map(id => ({
        routine: routineName,
        id,
        trigger: options.trigger,
        scheduledFor: options.scheduledFor ?? null,
        maxParallel,
        queuedAt,
      })),
    ]);
  }
  return startDetachedRun(routineName, { ...options, runId: firstId });
}

export function startDetachedReply(run: RunRecord, message: ChatMessage): void {
  appendLogEvent(run, { type: 'message', ...message });
  const child = spawn(process.execPath, getCliArgs('reply', run.routine, run.id), {
    cwd: config.projectRoot,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  // Written at once, so the run counts as replying before the reply process starts.
  writeRunRecord({ ...run, replyPid: child.pid ?? null });
  child.unref();
}
