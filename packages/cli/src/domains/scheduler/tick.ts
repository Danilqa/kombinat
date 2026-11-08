import type { SchedulerState, SkipReason } from 'domains/scheduler/types';
import { cronRunsBetween } from 'utils/cron';
import { getErrorMessage } from 'utils/error';

import { config } from '../../config';
import { loadRoutines } from '../routine/storage';
import type { Routine } from '../routine/types';
import { startDetachedRun } from '../run/runner';
import { getRunningRuns } from '../run/storage';
import { readSchedulerState, writeSchedulerState } from './storage';

function loadState(now: Date): SchedulerState {
  return (
    readSchedulerState() ?? {
      startedAt: now.toISOString(),
      lastTickAt: now.toISOString(),
      routines: {},
    }
  );
}

function recordSkip(
  state: SchedulerState,
  routine: Routine,
  scheduledFor: Date,
  reason: SkipReason,
  now: Date,
): void {
  const entry = state.routines[routine.name] ?? { lastScheduledFor: null, skips: [] };
  entry.skips = [
    ...entry.skips.slice(-49),
    { at: now.toISOString(), scheduledFor: scheduledFor.toISOString(), reason },
  ];
  entry.lastScheduledFor = scheduledFor.toISOString();
  state.routines[routine.name] = entry;
}

function markScheduled(state: SchedulerState, routine: Routine, scheduledFor: Date): void {
  const entry = state.routines[routine.name] ?? { lastScheduledFor: null, skips: [] };
  entry.lastScheduledFor = scheduledFor.toISOString();
  state.routines[routine.name] = entry;
}

export interface TickResult {
  started: string[];
  skipped: string[];
}

export function tick(now = new Date()): TickResult {
  const state = loadState(now);
  const started: string[] = [];
  const skipped: string[] = [];
  const floor = new Date(now.getTime() - config.catchUpWindowDays * 86_400_000);
  const lastTick = new Date(state.lastTickAt);
  let runningCount = getRunningRuns().length;
  const runningNames = new Set(getRunningRuns().map(r => r.routine));

  for (const routine of loadRoutines()) {
    if (!routine.schedule) continue;
    const entry = state.routines[routine.name];
    const lastScheduled = entry?.lastScheduledFor ? new Date(entry.lastScheduledFor) : null;
    const after = new Date(
      Math.max(floor.getTime(), lastTick.getTime(), lastScheduled?.getTime() ?? 0),
    );
    const due = cronRunsBetween(routine.schedule, after, now);
    const scheduledFor = due.at(-1);
    if (scheduledFor === undefined) continue;
    const isCatchUp =
      due.length > 1 ||
      now.getTime() - scheduledFor.getTime() > 2 * config.tickSeconds * 1000 + 60_000;

    if (!routine.enabled) {
      recordSkip(state, routine, scheduledFor, 'disabled', now);
      continue;
    }
    if (runningNames.has(routine.name)) {
      recordSkip(state, routine, scheduledFor, 'already_running', now);
      skipped.push(`${routine.name} (already running)`);
      continue;
    }
    if (runningCount >= config.maxConcurrentRuns) {
      skipped.push(`${routine.name} (concurrency limit, will retry)`);
      continue;
    }
    startDetachedRun(routine.name, {
      trigger: isCatchUp ? 'catch_up' : 'schedule',
      scheduledFor: scheduledFor.toISOString(),
    });
    markScheduled(state, routine, scheduledFor);
    runningCount += 1;
    runningNames.add(routine.name);
    started.push(routine.name);
  }

  state.lastTickAt = now.toISOString();
  writeSchedulerState(state);
  return { started, skipped };
}

export function startSchedulerLoop(log: (line: string) => void): () => void {
  const run = () => {
    try {
      const { started, skipped } = tick();
      for (const name of started) log(`started ${name}`);
      for (const name of skipped) log(`skipped ${name}`);
    } catch (err) {
      log(`tick failed: ${getErrorMessage(err)}`);
    }
  };
  run();
  const timer = setInterval(run, config.tickSeconds * 1000);
  return () => clearInterval(timer);
}
