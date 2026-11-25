import { isMatching, match, P } from 'ts-pattern';

import { sessionIdSchema, type SessionId } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import type { RoutineName } from 'domains/routine/ids';
import { runIdSchema, type RunId } from 'domains/run/ids';
import type {
  RunRecord,
  RunRetry,
  RunStatus,
  RunTrigger,
  RunWorktree,
  TokenCounts,
  UsageLimitWait,
  UsageLimitWaitAction,
} from 'domains/run/types';
import { RETRY_DELAY_MINUTES } from 'domains/run/constants';
import { compareRunsByNewest, getWorktreeBranch } from 'domains/run/utils';
import { transcriptItemSchema } from 'domains/transcript/schemas';
import type { Skip, SkipReason } from 'domains/scheduler/types';
import type {
  RetryItem,
  Transcript,
  TranscriptItem,
  UsageLimitItem,
  UsageLimitKind,
  UsageLimitOutcome,
} from 'domains/transcript/types';
import { cronRunsBetween } from 'utils/cron';

import { STATE_DIR } from './constants';
import { createRandom, randomId, randomInt, randomUuid, type Random } from './random';
import type { DemoOutcome, DemoPin, DemoRoutine, DemoStartedRun } from './routines';
import { check } from './transcript';

// Twice the longest period of the Insights page, so it has the days before to compare with.
const HISTORY_DAYS = 60;
const DAY_MS = 86_400_000;
const MAX_SKIPS = 50;
// Short enough to watch a run started with Run now finish.
const RUN_NOW_MINUTES = 0.5;
const REPLY_MS = 4000;
const REPLY_TEXT =
  'This is the demo, so no agent runs here. On your machine, Kombinat resumes the session of this run with your message, and the reply streams into this transcript as the agent works.';

interface DemoRun {
  routine: DemoRoutine;
  outcome: DemoOutcome;
  id: RunId;
  trigger: RunTrigger;
  scheduledFor: Date | null;
  startedAt: Date;
  pid: number;
  sessionId: SessionId;
}

interface DemoMessage {
  text: string;
  sentAt: Date;
  // Allow and continue sends the message that allows what the run was blocked from.
  isAllowing: boolean;
}

interface DemoWaitAction {
  action: UsageLimitWaitAction;
  at: Date;
}

interface UsageLimitStop {
  kind: 'usage-limit';
  limit: UsageLimitKind;
}

interface RetryStop {
  kind: 'retry';
  error: string;
}

// A usage limit or an error that stops the run for a while, until it continues its session.
interface DemoPause {
  stop: UsageLimitStop | RetryStop;
  afterStep: number;
  stoppedAt: Date;
  continuesAt: Date;
  // When the wait ends: at its time, or earlier with Continue now, Retry now or a stop.
  endedAt: Date;
  outcome: UsageLimitOutcome;
}

interface ScheduledEvents {
  runs: DemoRun[];
  skips: Skip[];
}

export interface DemoHistory {
  listRuns(now: Date): RunRecord[];
  listSkips(routine: DemoRoutine, now: Date): Skip[];
  getTranscript(routine: RoutineName, id: RunId, now: Date): Transcript | null;
  // A one-time run passes the time it was scheduled for.
  startRun(routine: DemoRoutine, now: Date, scheduledFor?: Date): RunId;
  sendMessage(routine: RoutineName, id: RunId, text: string, now: Date): void;
  allowBlockedActions(routine: RoutineName, id: RunId, text: string, now: Date): void;
  sendWaitAction(routine: RoutineName, id: RunId, action: UsageLimitWaitAction, now: Date): void;
  removeWorktree(routine: RoutineName, id: RunId): void;
  // A routine added from a template runs from the time it was added.
  addRoutine(routine: DemoRoutine, now: Date): void;
}

function fail(message: string): never {
  throw new Error(message);
}

function toRunId(startedAt: Date, random: Random): RunId {
  const stamp = startedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  return runIdSchema.parse(`${stamp}-${randomId(random, 4)}`);
}

function pickOutcome(routine: DemoRoutine, random: Random): DemoOutcome {
  const total = routine.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  let left = random() * total;
  const picked = routine.outcomes.find(outcome => {
    left -= outcome.weight;
    return left < 0;
  });
  return picked ?? routine.outcomes[0] ?? fail(`${routine.name} has no outcomes`);
}

function findOutcome(routine: DemoRoutine, id: string): DemoOutcome {
  return (
    routine.outcomes.find(outcome => outcome.id === id) ??
    fail(`${routine.name} has no outcome ${id}`)
  );
}

function createRun(
  routine: DemoRoutine,
  outcome: DemoOutcome,
  trigger: RunTrigger,
  scheduledFor: Date | null,
  startedAt: Date,
  random: Random,
): DemoRun {
  return {
    routine,
    outcome,
    id: toRunId(startedAt, random),
    trigger,
    scheduledFor,
    startedAt,
    pid: randomInt(random, 20_000, 89_999),
    sessionId: sessionIdSchema.parse(randomUuid(random)),
  };
}

function getDurationMs(run: DemoRun): number {
  return Math.round(run.outcome.minutes * 60_000);
}

function getPause(run: DemoRun, waitAction: DemoWaitAction | undefined): DemoPause | null {
  const { usageLimit, retry, steps } = run.outcome;
  const planned =
    usageLimit === undefined
      ? retry === undefined
        ? null
        : {
            stop: { kind: 'retry' as const, error: retry.error },
            afterStep: retry.afterStep,
            waitMinutes: RETRY_DELAY_MINUTES,
          }
      : {
          stop: { kind: 'usage-limit' as const, limit: usageLimit.limit },
          afterStep: usageLimit.afterStep,
          waitMinutes: usageLimit.waitMinutes,
        };
  if (planned === null) return null;
  const workMs = (getDurationMs(run) * planned.afterStep) / steps.length;
  const stoppedAt = new Date(run.startedAt.getTime() + workMs);
  const continuesAt = new Date(stoppedAt.getTime() + planned.waitMinutes * 60_000);
  const isEarly =
    waitAction !== undefined && waitAction.at >= stoppedAt && waitAction.at < continuesAt;
  return {
    stop: planned.stop,
    afterStep: planned.afterStep,
    stoppedAt,
    continuesAt,
    endedAt: isEarly ? waitAction.at : continuesAt,
    outcome: isEarly && isMatching({ action: 'stop' }, waitAction) ? 'stopped' : 'continued',
  };
}

function getEndTime(run: DemoRun, pause: DemoPause | null): number {
  if (pause === null) return run.startedAt.getTime() + getDurationMs(run);
  if (isMatching({ outcome: 'stopped' }, pause)) return pause.endedAt.getTime();
  const workedBeforeMs = pause.stoppedAt.getTime() - run.startedAt.getTime();
  return pause.endedAt.getTime() + getDurationMs(run) - workedBeforeMs;
}

function checkIsRunning(run: DemoRun, pause: DemoPause | null, now: Date): boolean {
  return getEndTime(run, pause) > now.getTime();
}

function checkIsWaiting(pause: DemoPause, now: Date): boolean {
  return now >= pause.stoppedAt && now < pause.endedAt;
}

function getStatus(run: DemoRun, pause: DemoPause | null, now: Date): RunStatus {
  if (pause !== null && checkIsWaiting(pause, now)) {
    return isMatching({ stop: { kind: 'retry' } }, pause) ? 'retrying' : 'waiting';
  }
  if (checkIsRunning(run, pause, now)) return 'running';
  return isMatching({ outcome: 'stopped' }, pause) ? 'failed' : run.outcome.status;
}

function getExitCode(outcome: DemoOutcome): number | null {
  return match(outcome.status)
    .with('succeeded', () => 0)
    .with('failed', () => (outcome.exitCode === undefined ? 1 : outcome.exitCode))
    .with('timed_out', 'aborted', () => null)
    .exhaustive();
}

function getResumeCommand(agent: AgentName, sessionId: SessionId): string | null {
  return match(agent)
    .with('claude', () => `claude --resume ${sessionId}`)
    .with('codex', () => `codex resume ${sessionId}`)
    .with('command', () => null)
    .exhaustive();
}

// About what a Claude Code session reads from its cache each minute, so a long run uses millions.
const TOKENS_PER_MINUTE = 78_000;

function getTokens(run: DemoRun): TokenCounts | null {
  const { routine, outcome } = run;
  if (outcome.numTurns === undefined) return null;
  const random = createRandom(`${routine.name}:${run.id}:tokens`);
  const total = outcome.minutes * TOKENS_PER_MINUTE * (0.8 + random() * 0.4);
  return match(routine.agent)
    .with('claude', (): TokenCounts => ({
      input: Math.round(total * 0.0035),
      output: Math.round(total * 0.0073),
      cacheWrite: Math.round(total * 0.031),
      cacheRead: Math.round(total * 0.9582),
    }))
    .with('codex', (): TokenCounts => ({
      input: Math.round(total * 0.1),
      output: Math.round(total * 0.02),
      cacheWrite: 0,
      cacheRead: Math.round(total * 0.88),
    }))
    .with('command', () => null)
    .exhaustive();
}

const BASE_COMMIT = '3f9c2a17e0b84d6c5a1e7f2b9d0c4e8a6b3f1d27';

function getWorktreePath({ routine, id }: DemoRun): string {
  return `${STATE_DIR}/worktrees/${routine.name}/${id}`;
}

function buildSteps(run: DemoRun): TranscriptItem[] {
  const items = run.outcome.steps.map((step, index) => step(String(index)));
  if (run.routine.worktree !== true) return items;
  // The agent of a worktree run works in its worktree, so its paths point there.
  return items.map(item =>
    transcriptItemSchema.parse(
      JSON.parse(JSON.stringify(item).replaceAll(run.routine.cwd, getWorktreePath(run))),
    ),
  );
}

function getWorktree(run: DemoRun, hasEnded: boolean, isRemoved: boolean): RunWorktree {
  const { routine, outcome } = run;
  const files = outcome.changedFiles ?? [];
  const path = getWorktreePath(run);
  return {
    branch: getWorktreeBranch(routine.name, run.id),
    path,
    cwd: path,
    checkout: routine.cwd,
    base: 'origin/main',
    baseCommit: BASE_COMMIT,
    changes: hasEnded
      ? {
          files,
          fileCount: files.length,
          added: files.reduce((sum, file) => sum + (file.added ?? 0), 0),
          removed: files.reduce((sum, file) => sum + (file.removed ?? 0), 0),
          commits: files.length === 0 ? 0 : 1,
          uncommitted: 0,
        }
      : null,
    state: match({ hasEnded, isRemoved, hasChanges: files.length > 0 })
      .with({ hasEnded: true, hasChanges: false }, () => 'discarded' as const)
      .with({ isRemoved: true }, () => 'removed' as const)
      .otherwise(() => 'present' as const),
  };
}

function checkIsReplying(messages: DemoMessage[], now: Date): boolean {
  const last = messages.at(-1);
  return last !== undefined && last.sentAt.getTime() + REPLY_MS > now.getTime();
}

// As on the daemon, the run keeps its blocked actions until the reply that allows them ends.
function checkIsAllowed(message: DemoMessage, now: Date): boolean {
  return message.isAllowing && message.sentAt.getTime() + REPLY_MS <= now.getTime();
}

function toRunRecord(
  run: DemoRun,
  now: Date,
  messages: DemoMessage[],
  pause: DemoPause | null,
  isWorktreeRemoved = false,
): RunRecord {
  const { routine, outcome } = run;
  const durationMs = getDurationMs(run);
  const isRunning = checkIsRunning(run, pause, now);
  const isStopped = !isRunning && isMatching({ outcome: 'stopped' }, pause);
  const hasSession =
    !isMatching({ agent: 'command' }, routine) &&
    buildSteps(run).some(isMatching({ kind: 'init' }));
  const sessionId = hasSession ? run.sessionId : null;
  const hasResult =
    !isRunning &&
    !isStopped &&
    isMatching({ agent: 'claude' }, routine) &&
    outcome.numTurns !== undefined;
  const isFinished = !isRunning && !isStopped;
  return {
    id: run.id,
    routine: routine.name,
    agent: routine.agent,
    trigger: run.trigger,
    scheduledFor: run.scheduledFor?.toISOString() ?? null,
    startedAt: run.startedAt.toISOString(),
    endedAt: isRunning ? null : new Date(getEndTime(run, pause)).toISOString(),
    status: getStatus(run, pause, now),
    pid: run.pid,
    exitCode: isStopped ? 1 : isRunning ? null : getExitCode(outcome),
    sessionId,
    resumeCommand: sessionId === null ? null : getResumeCommand(routine.agent, sessionId),
    model: hasSession ? (outcome.model ?? routine.runModel) : null,
    costUsd: isFinished ? (outcome.costUsd ?? null) : null,
    numTurns: isFinished ? (outcome.numTurns ?? null) : null,
    durationMs: hasResult ? durationMs : null,
    resultText: isFinished ? (outcome.resultText ?? null) : null,
    error: isStopped
      ? match(pause.stop)
          .with({ kind: 'retry' }, ({ error }) => error)
          .otherwise(() => "You've hit your session limit")
      : isFinished
        ? (outcome.error ?? null)
        : null,
    logFile: `${STATE_DIR}/runs/${routine.name}/${run.id}.jsonl`,
    replyPid: checkIsReplying(messages, now) ? run.pid + 1 : null,
    conversation: null,
    usageLimit: getUsageLimit(pause, now),
    retry: getRetry(run, pause, now),
    tokens: isFinished ? getTokens(run) : null,
    blockedActions:
      isFinished && !messages.some(message => checkIsAllowed(message, now))
        ? (outcome.blockedActions ?? [])
        : [],
    memorySentAt: null,
    worktree: routine.worktree === true ? getWorktree(run, !isRunning, isWorktreeRemoved) : null,
  };
}

function getUsageLimit(pause: DemoPause | null, now: Date): UsageLimitWait | null {
  if (pause === null || !checkIsWaiting(pause, now)) return null;
  return match(pause.stop)
    .with({ kind: 'usage-limit' }, ({ limit }) => ({
      limit,
      stoppedAt: pause.stoppedAt.toISOString(),
      continuesAt: pause.continuesAt.toISOString(),
    }))
    .otherwise(() => null);
}

// Set once the first attempt stops, and kept while the second runs, unless the user stopped retrying.
function getRetry(run: DemoRun, pause: DemoPause | null, now: Date): RunRetry | null {
  if (pause === null || now < pause.stoppedAt) return null;
  const hasStopped = isMatching({ outcome: 'stopped' }, pause) && now >= pause.endedAt;
  return match(pause.stop)
    .with({ kind: 'retry' }, ({ error }): RunRetry | null =>
      hasStopped
        ? null
        : {
            attempt: 2,
            attempts: (run.routine.retries ?? 0) + 1,
            error,
            stoppedAt: pause.stoppedAt.toISOString(),
            continuesAt: pause.continuesAt.toISOString(),
            continuesSession: true,
          },
    )
    .otherwise(() => null);
}

function getResultItems(record: RunRecord): TranscriptItem[] {
  if (record.numTurns === null) return [];
  return match(record.agent)
    .with('claude', (): TranscriptItem[] => [
      {
        kind: 'result',
        key: 'result',
        text: record.resultText ?? '',
        isError: !isMatching({ status: 'succeeded' }, record),
        costUsd: record.costUsd,
        numTurns: record.numTurns,
        durationMs: record.durationMs,
      },
    ])
    .with('codex', (): TranscriptItem[] => [
      {
        kind: 'result',
        key: 'result',
        text: record.error ?? '',
        isError: record.error !== null,
        costUsd: null,
        numTurns: record.numTurns,
        durationMs: null,
      },
    ])
    .with('command', () => [])
    .exhaustive();
}

function getWorkedMs(run: DemoRun, pause: DemoPause | null, now: Date): number {
  const elapsedMs = now.getTime() - run.startedAt.getTime();
  if (pause === null || now <= pause.stoppedAt) return elapsedMs;
  const workedBeforeMs = pause.stoppedAt.getTime() - run.startedAt.getTime();
  return workedBeforeMs + Math.max(0, now.getTime() - pause.endedAt.getTime());
}

function toPauseItem(run: DemoRun, pause: DemoPause, now: Date): UsageLimitItem | RetryItem {
  const stoppedAt = pause.stoppedAt.toISOString();
  const continuesAt = pause.continuesAt.toISOString();
  const endedAt = now >= pause.endedAt ? pause.endedAt.toISOString() : null;
  return match(pause.stop)
    .with({ kind: 'usage-limit' }, ({ limit }): UsageLimitItem => ({
      kind: 'usage-limit',
      key: 'usage-limit-0',
      limit,
      stoppedAt,
      continuesAt,
      end: endedAt === null ? null : { at: endedAt, outcome: pause.outcome },
    }))
    .with({ kind: 'retry' }, ({ error }): RetryItem => ({
      kind: 'retry',
      key: 'retry-0',
      attempt: 2,
      attempts: (run.routine.retries ?? 0) + 1,
      error,
      stoppedAt,
      continuesAt,
      continuesSession: true,
      end:
        endedAt === null
          ? null
          : {
              at: endedAt,
              outcome: isMatching('stopped', pause.outcome) ? 'stopped' : 'retried',
            },
    }))
    .exhaustive();
}

function withPause(
  run: DemoRun,
  items: TranscriptItem[],
  pause: DemoPause | null,
  now: Date,
): TranscriptItem[] {
  if (pause === null || now < pause.stoppedAt) return items;
  return [
    ...items.slice(0, pause.afterStep),
    toPauseItem(run, pause, now),
    ...(isMatching({ outcome: 'stopped' }, pause) ? [] : items.slice(pause.afterStep)),
  ];
}

// A running run shows the steps it has reached so far, with the last tool call still pending.
function getRunningItems(run: DemoRun, pause: DemoPause | null, now: Date): TranscriptItem[] {
  const steps = buildSteps(run);
  const isWaiting = pause !== null && checkIsWaiting(pause, now);
  const progress = getWorkedMs(run, pause, now) / getDurationMs(run);
  const reached = isWaiting
    ? steps.slice(0, pause.afterStep)
    : steps.slice(0, Math.max(1, Math.ceil(progress * steps.length)));
  const last = reached.at(-1);
  const items =
    isWaiting || last === undefined || !isMatching({ kind: 'tool' }, last)
      ? reached
      : [...reached.slice(0, -1), { ...last, result: null }];
  return withPause(run, items, pause, now);
}

// A reply shows its text halfway through and its result once it is done.
function getReplyItems(messages: DemoMessage[], now: Date): TranscriptItem[] {
  return messages.flatMap(({ text, sentAt }, index): TranscriptItem[] => {
    const key = `reply-${index}`;
    const elapsedMs = now.getTime() - sentAt.getTime();
    const message: TranscriptItem = { kind: 'message', key, text, source: 'dashboard' };
    if (elapsedMs < REPLY_MS / 2) return [message];
    const reply: TranscriptItem = {
      kind: 'text',
      key: `${key}-text`,
      text: REPLY_TEXT,
      isSubagent: false,
    };
    if (elapsedMs < REPLY_MS) return [message, reply];
    return [
      message,
      reply,
      {
        kind: 'result',
        key: `${key}-result`,
        text: REPLY_TEXT,
        isError: false,
        costUsd: null,
        numTurns: 1,
        durationMs: REPLY_MS,
      },
    ];
  });
}

function buildTranscript(
  run: DemoRun,
  now: Date,
  messages: DemoMessage[],
  pause: DemoPause | null,
): Transcript {
  const record = toRunRecord(run, now, messages, pause);
  const items = checkIsRunning(run, pause, now)
    ? getRunningItems(run, pause, now)
    : [
        ...withPause(run, buildSteps(run), pause, now),
        ...getResultItems(record),
        ...getReplyItems(messages, now),
      ];
  const toolResults = items.filter(isMatching({ kind: 'tool', result: P.nonNullable }));
  return { eventCount: items.length + toolResults.length, items };
}

function getPinsBySlot(routine: DemoRoutine, slots: Date[]): Map<number, DemoPin> {
  return new Map(
    (routine.pins ?? []).flatMap((pin): Array<[number, DemoPin]> => {
      const slot = slots.at(-1 - pin.slotsAgo);
      return slot === undefined ? [] : [[slot.getTime(), pin]];
    }),
  );
}

function toSkip(
  slot: Date,
  reason: SkipReason,
  random: Random,
  checkOutput: string | null = null,
): Skip {
  return {
    at: new Date(slot.getTime() + randomInt(random, 1, 29) * 1000).toISOString(),
    scheduledFor: slot.toISOString(),
    reason,
    checkOutput,
  };
}

// A scheduled run starts with the routine's check, which runs before the agent.
function withCheck(routine: DemoRoutine, outcome: DemoOutcome): DemoOutcome {
  if (routine.check === undefined || outcome.checkOutput === undefined) return outcome;
  return {
    ...outcome,
    steps: [check(routine.check.command, 0, outcome.checkOutput), ...outcome.steps],
  };
}

function buildScheduledEvents(
  routine: DemoRoutine,
  slots: Date[],
  pins: Map<number, DemoPin>,
  disabledAt: Date | null,
): ScheduledEvents {
  const runs: DemoRun[] = [];
  const skips: Skip[] = [];
  for (const slot of slots) {
    const random = createRandom(`${routine.name}:${slot.toISOString()}`);
    const pin = pins.get(slot.getTime());
    if (disabledAt !== null && slot >= disabledAt) {
      skips.push(toSkip(slot, 'disabled', random));
    } else if (pin?.skip === undefined) {
      const outcome =
        pin?.outcome === undefined
          ? pickOutcome(routine, random)
          : findOutcome(routine, pin.outcome);
      if (outcome.id === routine.check?.skipsOutcome) {
        skips.push(toSkip(slot, 'nothing_to_do', random, routine.check.skipOutput));
        continue;
      }
      const delayMs =
        pin?.lateMinutes === undefined ? randomInt(random, 2, 20) * 1000 : pin.lateMinutes * 60_000;
      const trigger = pin?.lateMinutes === undefined ? 'schedule' : 'catch_up';
      const startedAt = new Date(slot.getTime() + delayMs);
      runs.push(createRun(routine, withCheck(routine, outcome), trigger, slot, startedAt, random));
    } else {
      skips.push(toSkip(slot, pin.skip, random));
      if (isMatching({ skip: 'already_running' }, pin)) {
        const startedAt = new Date(slot.getTime() - 5 * 60_000);
        runs.push(
          createRun(routine, pickOutcome(routine, random), 'manual', null, startedAt, random),
        );
      }
    }
  }
  return { runs, skips };
}

export function createDemoHistory(initialRoutines: DemoRoutine[], loadedAt: Date): DemoHistory {
  const routines = [...initialRoutines];
  const addedAt = new Map<RoutineName, Date>();
  const historyStart = new Date(loadedAt.getTime() - HISTORY_DAYS * DAY_MS);
  const toStartedRuns = (
    routine: DemoRoutine,
    trigger: RunTrigger,
    started: DemoStartedRun[] = [],
  ): DemoRun[] =>
    started.map(({ minutesAgo, outcome }) => {
      const startedAt = new Date(loadedAt.getTime() - minutesAgo * 60_000);
      const random = createRandom(`${routine.name}:${trigger}:${startedAt.toISOString()}`);
      return createRun(routine, findOutcome(routine, outcome), trigger, null, startedAt, random);
    });
  const startedRuns: DemoRun[] = routines.flatMap(routine => [
    ...toStartedRuns(routine, 'manual', routine.manualRuns),
    ...toStartedRuns(routine, 'webhook', routine.webhookRuns),
  ]);
  const messages = new Map<string, DemoMessage[]>();
  const getMessages = (routine: RoutineName, id: RunId) => messages.get(`${routine}/${id}`) ?? [];
  const waitActions = new Map<string, DemoWaitAction>();
  const findPause = (run: DemoRun) =>
    getPause(run, waitActions.get(`${run.routine.name}/${run.id}`));
  const removedWorktrees = new Set<string>();
  const slotsBeforeLoad = new Map(
    routines.map(routine => [
      routine.name,
      routine.schedule === null ? [] : cronRunsBetween(routine.schedule, historyStart, loadedAt),
    ]),
  );

  // Times after the page loaded become runs too, so a tab left open keeps a live history.
  function getScheduledEvents(routine: DemoRoutine, now: Date): ScheduledEvents {
    const before = slotsBeforeLoad.get(routine.name) ?? [];
    const from = addedAt.get(routine.name) ?? loadedAt;
    const after =
      routine.schedule === null || now <= from ? [] : cronRunsBetween(routine.schedule, from, now);
    const disabledAt =
      routine.disabledDaysAgo === undefined
        ? null
        : new Date(loadedAt.getTime() - routine.disabledDaysAgo * DAY_MS);
    const events = buildScheduledEvents(
      routine,
      [...before, ...after],
      getPinsBySlot(routine, before),
      disabledAt,
    );
    return {
      runs: events.runs.filter(run => run.startedAt <= now),
      skips: events.skips.filter(skip => new Date(skip.at) <= now),
    };
  }

  function listDemoRuns(now: Date): DemoRun[] {
    return [
      ...routines.flatMap(routine => getScheduledEvents(routine, now).runs),
      ...startedRuns.filter(run => run.startedAt <= now),
    ];
  }

  function findDemoRun(routine: RoutineName, id: RunId, now: Date): DemoRun | undefined {
    return listDemoRuns(now).find(run => run.routine.name === routine && run.id === id);
  }

  return {
    listRuns: now =>
      listDemoRuns(now)
        .map(run =>
          toRunRecord(
            run,
            now,
            getMessages(run.routine.name, run.id),
            findPause(run),
            removedWorktrees.has(`${run.routine.name}/${run.id}`),
          ),
        )
        .sort(compareRunsByNewest),
    listSkips: (routine, now) => getScheduledEvents(routine, now).skips.slice(-MAX_SKIPS),
    getTranscript(routine, id, now) {
      const run = findDemoRun(routine, id, now);
      return run === undefined
        ? null
        : buildTranscript(run, now, getMessages(routine, id), findPause(run));
    },
    startRun(routine, now, scheduledFor) {
      // Runs of one start that begin together still get ids of their own.
      const random = createRandom(
        `${routine.name}:run-now:${now.toISOString()}:${startedRuns.length}`,
      );
      const outcome = { ...pickOutcome(routine, random), minutes: RUN_NOW_MINUTES };
      const trigger = scheduledFor === undefined ? 'manual' : 'schedule';
      const run = createRun(routine, outcome, trigger, scheduledFor ?? null, now, random);
      startedRuns.push(run);
      return run.id;
    },
    sendMessage(routine, id, text, now) {
      // A reply brings the worktree back, as it does on your machine.
      removedWorktrees.delete(`${routine}/${id}`);
      messages.set(`${routine}/${id}`, [
        ...getMessages(routine, id),
        { text, sentAt: now, isAllowing: false },
      ]);
    },
    allowBlockedActions(routine, id, text, now) {
      removedWorktrees.delete(`${routine}/${id}`);
      messages.set(`${routine}/${id}`, [
        ...getMessages(routine, id),
        { text, sentAt: now, isAllowing: true },
      ]);
    },
    sendWaitAction(routine, id, action, now) {
      waitActions.set(`${routine}/${id}`, { action, at: now });
    },
    removeWorktree(routine, id) {
      removedWorktrees.add(`${routine}/${id}`);
    },
    addRoutine(routine, now) {
      routines.push(routine);
      addedAt.set(routine.name, now);
    },
  };
}
