import { isMatching, match, P } from 'ts-pattern';

import type { AccountName } from 'domains/agent/ids';
import { getCurrentUsageLimits } from 'domains/daemon/utils';
import type { RoutineName } from 'domains/routine/ids';
import { listChainLoops } from 'domains/routine/utils';
import type { QueuedRun, RunRecord } from 'domains/run/types';
import { checkIsRunAtWork } from 'domains/run/utils';
import type {
  OneTimeRun,
  SchedulerRoutineState,
  SchedulerState,
  SkipReason,
} from 'domains/scheduler/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { cronRunsBetween } from 'utils/cron';
import { getErrorMessage } from 'utils/error';

import { config } from '../../config';
import { readPlanUsage } from '../agent/storage';
import { loadRoutines } from '../routine/storage';
import type { Routine } from '../routine/types';
import {
  checkIsRunning,
  countStartingRuns,
  startDetachedRun,
  startDetachedRuns,
} from '../run/launcher';
import type { RunBatch } from '../run/launcher';
import { appendChainedRun } from '../run/payload';
import { dropQueuedRun, readQueuedRuns, writeQueuedRuns } from '../run/queued-runs';
import type { RunOptions } from '../run/runner';
import { getRunningRuns, listRuns } from '../run/storage';
import { checkIsWaitOver, requestWaitAction } from '../run/usage-limit';
import { listQueuedRoutines, takeQueuedWebhook } from '../webhook/queue';
import { startWebhook } from '../webhook/start';
import { findChainStart } from './chain';
import { checkIsChecking, prepareCheckedRun, runCheck } from './check';
import {
  readOneTimeRuns,
  readSchedulerState,
  writeOneTimeRuns,
  writeSchedulerState,
} from './storage';

function loadState(now: Date): SchedulerState {
  return (
    readSchedulerState() ?? {
      startedAt: now.toISOString(),
      lastTickAt: now.toISOString(),
      routines: {},
    }
  );
}

function getEntry(state: SchedulerState, routine: Routine): SchedulerRoutineState {
  const entry = state.routines[routine.name] ?? {
    lastScheduledFor: null,
    skips: [],
    chainedAfter: null,
  };
  state.routines[routine.name] = entry;
  return entry;
}

function addSkip(
  state: SchedulerState,
  routine: Routine,
  scheduledFor: Date,
  reason: SkipReason,
  now: Date,
  checkOutput: string | null = null,
): void {
  const entry = getEntry(state, routine);
  entry.skips = [
    ...entry.skips.slice(-49),
    { at: now.toISOString(), scheduledFor: scheduledFor.toISOString(), reason, checkOutput },
  ];
}

function checkIsLate(scheduledFor: Date, now: Date): boolean {
  return now.getTime() - scheduledFor.getTime() > 2 * config.tickSeconds * 1000 + 60_000;
}

function markScheduled(state: SchedulerState, routine: Routine, scheduledFor: Date): void {
  getEntry(state, routine).lastScheduledFor = scheduledFor.toISOString();
}

function recordSkip(
  state: SchedulerState,
  routine: Routine,
  scheduledFor: Date,
  reason: SkipReason,
  now: Date,
): void {
  addSkip(state, routine, scheduledFor, reason, now);
  markScheduled(state, routine, scheduledFor);
}

const toBatch = (routine: Routine): RunBatch => ({
  count: routine.runs,
  maxParallel: routine.maxParallel,
});

// The runs that started and have no record yet, and the checks, which take a slot until they end.
function countStarting(routine: RoutineName): number {
  return countStartingRuns(routine) + (checkIsChecking(routine) ? 1 : 0);
}

function countRunsAtWork(routines: Routine[], runningRuns: RunRecord[]): number {
  return (
    runningRuns.filter(checkIsRunAtWork).length +
    routines.reduce((sum, routine) => sum + countStarting(routine.name), 0)
  );
}

// A run started at a usage limit would stop at once, so queued runs wait for the reset with the runs
// that hit it. Each account has a plan of its own, so only its own runs wait.
function checkIsClaudeAtLimit(
  runningRuns: RunRecord[],
  account: AccountName | null,
  now: Date,
): boolean {
  const isRunWaiting = runningRuns.some(
    run =>
      isMatching({ agent: 'claude', status: 'waiting', usageLimit: P.nonNullable }, run) &&
      run.account === account &&
      new Date(run.usageLimit.continuesAt) > now,
  );
  const isUsedUp = getCurrentUsageLimits(readPlanUsage('claude', account), now.getTime()).some(
    limit => limit.usedRatio >= 1,
  );
  return isRunWaiting || isUsedUp;
}

// Oldest first, each while its routine has fewer runs at once than its start allows and a slot is free.
function takeQueuedRuns(
  routines: Routine[],
  runningRuns: RunRecord[],
  slotsTaken: number,
  now: Date,
): RoutineName[] {
  const queuedRuns = readQueuedRuns();
  if (queuedRuns.length === 0) return [];
  const started: RoutineName[] = [];
  const doneRuns = new Set<QueuedRun>();
  let runningCount = slotsTaken;
  for (const queued of queuedRuns) {
    const routine = routines.find(candidate => candidate.name === queued.routine);
    if (routine === undefined) {
      dropQueuedRun(queued);
      doneRuns.add(queued);
      continue;
    }
    if (runningCount >= config.maxConcurrentRuns) break;
    if (
      isMatching({ agent: 'claude' }, routine) &&
      checkIsClaudeAtLimit(runningRuns, routine.account, now)
    ) {
      continue;
    }
    const activeCount =
      runningRuns.filter(run => run.routine === routine.name).length + countStarting(routine.name);
    if (activeCount >= queued.maxParallel) continue;
    startDetachedRun(routine.name, {
      trigger: queued.trigger,
      scheduledFor: queued.scheduledFor,
      runId: queued.id,
    });
    doneRuns.add(queued);
    runningCount += 1;
    started.push(routine.name);
  }
  if (doneRuns.size > 0) writeQueuedRuns(queuedRuns.filter(queued => !doneRuns.has(queued)));
  return started;
}

// For a start outside the tick, so the runs it allows at once start without waiting for the next tick.
export function startQueuedRuns(now = new Date()): RoutineName[] {
  const routines = loadRoutines();
  const runningRuns = getRunningRuns();
  return takeQueuedRuns(routines, runningRuns, countRunsAtWork(routines, runningRuns), now);
}

interface TickResult {
  started: RoutineName[];
  continued: RoutineName[];
  skipped: string[];
  // Each resolves to the log line of a check that ends after the tick.
  checks: Promise<string>[];
}

interface CheckSkip {
  reason: SkipReason;
  output: string | null;
}

// The check runs while the tick goes on, so it can only add its skip once it ends.
async function startAfterCheck(
  routine: Routine,
  check: string,
  scheduledFor: Date,
  options: RunOptions,
): Promise<string> {
  try {
    const decision = await runCheck(routine, check);
    const skip = match(decision)
      .with({ outcome: 'skip' }, ({ output }): CheckSkip => ({ reason: 'nothing_to_do', output }))
      .with({ outcome: 'start' }, (start): CheckSkip | null => {
        if (checkIsRunning(routine.name)) return { reason: 'already_running', output: null };
        startDetachedRuns(
          routine.name,
          { ...options, runId: prepareCheckedRun(routine.name, start) },
          toBatch(routine),
        );
        startQueuedRuns();
        return null;
      })
      .exhaustive();
    if (skip === null) return `started ${routine.name}`;
    const now = new Date();
    const state = loadState(now);
    addSkip(state, routine, scheduledFor, skip.reason, now, skip.output);
    writeSchedulerState(state);
    return `skipped ${routine.name} (${getSkipReasonLabel(skip.reason)})`;
  } catch (err) {
    return `check of ${routine.name} failed: ${getErrorMessage(err)}`;
  }
}

export function tick(now = new Date()): TickResult {
  const state = loadState(now);
  const started: RoutineName[] = [];
  const continued: RoutineName[] = [];
  const skipped: string[] = [];
  const checks: Promise<string>[] = [];
  const floor = new Date(now.getTime() - config.catchUpWindowDays * 86_400_000);
  const lastTick = new Date(state.lastTickAt);
  const routines = loadRoutines();
  const runningRuns = getRunningRuns();
  const startingNames = routines.map(r => r.name).filter(name => countStarting(name) > 0);
  const runningNames = new Set([
    ...runningRuns.map(r => r.routine),
    ...startingNames,
    ...readQueuedRuns().map(queued => queued.routine),
  ]);
  const caughtUpNames = new Set<RoutineName>();
  // A run that waits out a usage limit or a retry keeps its routine busy but takes no slot.
  let runningCount = countRunsAtWork(routines, runningRuns);

  for (const routine of routines) {
    if (!routine.schedule) continue;
    const entry = state.routines[routine.name];
    const lastScheduled = entry?.lastScheduledFor ? new Date(entry.lastScheduledFor) : null;
    const after = new Date(
      Math.max(floor.getTime(), lastTick.getTime(), lastScheduled?.getTime() ?? 0),
    );
    const due = cronRunsBetween(routine.schedule, after, now);
    const scheduledFor = due.at(-1);
    if (scheduledFor === undefined) continue;
    const isCatchUp = due.length > 1 || checkIsLate(scheduledFor, now);

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
    const options: RunOptions = {
      trigger: isCatchUp ? 'catch_up' : 'schedule',
      scheduledFor: scheduledFor.toISOString(),
    };
    if (routine.check === null) {
      startDetachedRuns(routine.name, options, toBatch(routine));
      started.push(routine.name);
    } else {
      checks.push(startAfterCheck(routine, routine.check, scheduledFor, options));
    }
    markScheduled(state, routine, scheduledFor);
    if (isCatchUp) caughtUpNames.add(routine.name);
    runningCount += 1;
    runningNames.add(routine.name);
  }

  // Unlike a scheduled time, a one-time run waits while its routine runs instead of being skipped.
  const oneTimeRuns = readOneTimeRuns();
  const latestDueTimes = new Map<RoutineName, number>();
  for (const { routine, at } of oneTimeRuns) {
    const time = new Date(at).getTime();
    if (time > now.getTime()) continue;
    latestDueTimes.set(routine, Math.max(time, latestDueTimes.get(routine) ?? 0));
  }
  const doneOneTimeRuns = new Set<OneTimeRun>();
  for (const oneTimeRun of oneTimeRuns) {
    const scheduledFor = new Date(oneTimeRun.at);
    if (scheduledFor > now) continue;
    const isLate = checkIsLate(scheduledFor, now);
    // Like missed scheduled times, the due ones of a routine run once, within the catch-up window.
    const isCollapsed =
      scheduledFor < floor ||
      scheduledFor.getTime() < (latestDueTimes.get(oneTimeRun.routine) ?? 0) ||
      (isLate && caughtUpNames.has(oneTimeRun.routine));
    if (isCollapsed) {
      doneOneTimeRuns.add(oneTimeRun);
      continue;
    }
    const routine = routines.find(candidate => candidate.name === oneTimeRun.routine);
    if (routine === undefined) {
      doneOneTimeRuns.add(oneTimeRun);
      continue;
    }
    if (!routine.enabled) {
      addSkip(state, routine, scheduledFor, 'disabled', now);
      doneOneTimeRuns.add(oneTimeRun);
      continue;
    }
    if (runningNames.has(routine.name)) continue;
    if (runningCount >= config.maxConcurrentRuns) {
      skipped.push(`${routine.name} (concurrency limit, will retry)`);
      continue;
    }
    startDetachedRuns(
      routine.name,
      { trigger: isLate ? 'catch_up' : 'schedule', scheduledFor: oneTimeRun.at },
      toBatch(routine),
    );
    doneOneTimeRuns.add(oneTimeRun);
    runningCount += 1;
    runningNames.add(routine.name);
    started.push(routine.name);
  }
  if (doneOneTimeRuns.size > 0) {
    writeOneTimeRuns(oneTimeRuns.filter(oneTimeRun => !doneOneTimeRuns.has(oneTimeRun)));
  }

  // Unlike a scheduled time, a chained start waits while its routine runs instead of being skipped.
  const loopedNames = new Set(listChainLoops(routines).flat());
  for (const routine of routines) {
    const { startsAfter, startsWhen } = routine;
    if (startsAfter === null || startsWhen === null || loopedNames.has(routine.name)) continue;
    const entry = getEntry(state, routine);
    // Runs that ended before the routine started after this one are not its to start after.
    if (entry.chainedAfter?.routine !== startsAfter) {
      entry.chainedAfter = { routine: startsAfter, endedAt: now.toISOString() };
      continue;
    }
    const start = findChainStart(listRuns(startsAfter), entry.chainedAfter.endedAt, startsWhen);
    if (start === null) continue;
    if (start.run === null || !routine.enabled) {
      entry.chainedAfter = { routine: startsAfter, endedAt: start.endedAt };
      continue;
    }
    if (runningNames.has(routine.name)) continue;
    if (runningCount >= config.maxConcurrentRuns) {
      skipped.push(`${routine.name} (concurrency limit, will retry)`);
      continue;
    }
    startDetachedRuns(
      routine.name,
      { trigger: 'chain' },
      { ...toBatch(routine), prompt: appendChainedRun(routine.prompt, start.run) },
    );
    entry.chainedAfter = { routine: startsAfter, endedAt: start.endedAt };
    runningCount += 1;
    runningNames.add(routine.name);
    started.push(routine.name);
  }

  // After the schedules, so a run that waited out a usage limit or a retry never makes one skip.
  for (const run of runningRuns.toReversed()) {
    if (!checkIsWaitOver(run, now) || runningCount >= config.maxConcurrentRuns) continue;
    requestWaitAction(run, 'continue');
    runningCount += 1;
    continued.push(run.routine);
  }

  const startedQueued = takeQueuedRuns(routines, runningRuns, runningCount, now);
  started.push(...startedQueued);
  runningCount += startedQueued.length;
  for (const name of startedQueued) runningNames.add(name);

  // After the schedules, so the queue never makes one skip.
  for (const name of listQueuedRoutines()) {
    const routine = routines.find(candidate => candidate.name === name);
    if (routine === undefined || !routine.enabled || !routine.webhook) continue;
    if (runningNames.has(name) || runningCount >= config.maxConcurrentRuns) continue;
    const queued = takeQueuedWebhook(name);
    if (queued === null) continue;
    startWebhook(name, queued);
    runningCount += 1;
    runningNames.add(name);
    started.push(name);
  }

  state.lastTickAt = now.toISOString();
  writeSchedulerState(state);
  return { started, continued, skipped, checks };
}

export function startSchedulerLoop(log: (line: string) => void): () => void {
  const run = () => {
    try {
      const { started, continued, skipped, checks } = tick();
      for (const check of checks) void check.then(log);
      for (const name of started) log(`started ${name}`);
      for (const name of continued) log(`continued ${name}`);
      for (const name of skipped) log(`skipped ${name}`);
    } catch (err) {
      log(`tick failed: ${getErrorMessage(err)}`);
    }
  };
  run();
  const timer = setInterval(run, config.tickSeconds * 1000);
  return () => clearInterval(timer);
}
