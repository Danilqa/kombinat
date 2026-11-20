import { isMatching, match, P } from 'ts-pattern';

import { sessionIdSchema, type SessionId } from 'domains/agent/ids';
import type { AgentName } from 'domains/agent/types';
import type { RoutineName } from 'domains/routine/ids';
import { runIdSchema, type RunId } from 'domains/run/ids';
import type { RunRecord, RunStatus, RunTrigger, UsageLimitWaitAction } from 'domains/run/types';
import { compareRunsByNewest } from 'domains/run/utils';
import type { Skip, SkipReason } from 'domains/scheduler/types';
import type {
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

const HISTORY_DAYS = 14;
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
}

interface DemoWaitAction {
  action: UsageLimitWaitAction;
  at: Date;
}

interface DemoPause {
  limit: UsageLimitKind;
  afterStep: number;
  stoppedAt: Date;
  continuesAt: Date;
  // When the wait ends: at the reset, or earlier with Continue now or Stop waiting.
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
  sendWaitAction(routine: RoutineName, id: RunId, action: UsageLimitWaitAction, now: Date): void;
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
  const { usageLimit, steps } = run.outcome;
  if (usageLimit === undefined) return null;
  const workMs = (getDurationMs(run) * usageLimit.afterStep) / steps.length;
  const stoppedAt = new Date(run.startedAt.getTime() + workMs);
  const continuesAt = new Date(stoppedAt.getTime() + usageLimit.waitMinutes * 60_000);
  const isEarly =
    waitAction !== undefined && waitAction.at >= stoppedAt && waitAction.at < continuesAt;
  return {
    limit: usageLimit.limit,
    afterStep: usageLimit.afterStep,
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
  if (pause !== null && checkIsWaiting(pause, now)) return 'waiting';
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

function buildSteps(run: DemoRun): TranscriptItem[] {
  return run.outcome.steps.map((step, index) => step(String(index)));
}

function checkIsReplying(messages: DemoMessage[], now: Date): boolean {
  const last = messages.at(-1);
  return last !== undefined && last.sentAt.getTime() + REPLY_MS > now.getTime();
}

function toRunRecord(
  run: DemoRun,
  now: Date,
  messages: DemoMessage[],
  pause: DemoPause | null,
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
      ? "You've hit your session limit"
      : isFinished
        ? (outcome.error ?? null)
        : null,
    logFile: `${STATE_DIR}/runs/${routine.name}/${run.id}.jsonl`,
    replyPid: checkIsReplying(messages, now) ? run.pid + 1 : null,
    conversation: null,
    usageLimit:
      pause !== null && checkIsWaiting(pause, now)
        ? {
            limit: pause.limit,
            stoppedAt: pause.stoppedAt.toISOString(),
            continuesAt: pause.continuesAt.toISOString(),
          }
        : null,
  };
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

function toPauseItem(pause: DemoPause, now: Date): UsageLimitItem {
  return {
    kind: 'usage-limit',
    key: 'usage-limit-0',
    limit: pause.limit,
    stoppedAt: pause.stoppedAt.toISOString(),
    continuesAt: pause.continuesAt.toISOString(),
    end: now >= pause.endedAt ? { at: pause.endedAt.toISOString(), outcome: pause.outcome } : null,
  };
}

function withPause(items: TranscriptItem[], pause: DemoPause | null, now: Date): TranscriptItem[] {
  if (pause === null || now < pause.stoppedAt) return items;
  return [
    ...items.slice(0, pause.afterStep),
    toPauseItem(pause, now),
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
  return withPause(items, pause, now);
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
        ...withPause(buildSteps(run), pause, now),
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

function toSkip(slot: Date, reason: SkipReason, random: Random): Skip {
  return {
    at: new Date(slot.getTime() + randomInt(random, 1, 29) * 1000).toISOString(),
    scheduledFor: slot.toISOString(),
    reason,
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
      const delayMs =
        pin?.lateMinutes === undefined ? randomInt(random, 2, 20) * 1000 : pin.lateMinutes * 60_000;
      const trigger = pin?.lateMinutes === undefined ? 'schedule' : 'catch_up';
      const startedAt = new Date(slot.getTime() + delayMs);
      runs.push(createRun(routine, outcome, trigger, slot, startedAt, random));
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

export function createDemoHistory(routines: DemoRoutine[], loadedAt: Date): DemoHistory {
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
  const slotsBeforeLoad = new Map(
    routines.map(routine => [
      routine.name,
      routine.schedule === null ? [] : cronRunsBetween(routine.schedule, historyStart, loadedAt),
    ]),
  );

  // Times after the page loaded become runs too, so a tab left open keeps a live history.
  function getScheduledEvents(routine: DemoRoutine, now: Date): ScheduledEvents {
    const before = slotsBeforeLoad.get(routine.name) ?? [];
    const after =
      routine.schedule === null || now <= loadedAt
        ? []
        : cronRunsBetween(routine.schedule, loadedAt, now);
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
        .map(run => toRunRecord(run, now, getMessages(run.routine.name, run.id), findPause(run)))
        .sort(compareRunsByNewest),
    listSkips: (routine, now) => getScheduledEvents(routine, now).skips.slice(-MAX_SKIPS),
    getTranscript(routine, id, now) {
      const run = findDemoRun(routine, id, now);
      return run === undefined
        ? null
        : buildTranscript(run, now, getMessages(routine, id), findPause(run));
    },
    startRun(routine, now, scheduledFor) {
      const random = createRandom(`${routine.name}:run-now:${now.toISOString()}`);
      const outcome = { ...pickOutcome(routine, random), minutes: RUN_NOW_MINUTES };
      const trigger = scheduledFor === undefined ? 'manual' : 'schedule';
      const run = createRun(routine, outcome, trigger, scheduledFor ?? null, now, random);
      startedRuns.push(run);
      return run.id;
    },
    sendMessage(routine, id, text, now) {
      messages.set(`${routine}/${id}`, [...getMessages(routine, id), { text, sentAt: now }]);
    },
    sendWaitAction(routine, id, action, now) {
      waitActions.set(`${routine}/${id}`, { action, at: now });
    },
  };
}
