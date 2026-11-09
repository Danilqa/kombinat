import { isMatching, match, P } from 'ts-pattern';

import type { AgentName } from 'domains/agent/types';
import type { RunRecord, RunTrigger } from 'domains/run/types';
import type { Skip, SkipReason } from 'domains/scheduler/types';
import type { Transcript, TranscriptItem } from 'domains/transcript/types';
import { cronRunsBetween } from 'utils/cron';

import { STATE_DIR } from './constants';
import { createRandom, randomId, randomInt, randomUuid, type Random } from './random';
import type { DemoOutcome, DemoPin, DemoRoutine, DemoStartedRun } from './routines';

const HISTORY_DAYS = 14;
const DAY_MS = 86_400_000;
const MAX_SKIPS = 50;
// Short enough to watch a run started with Run now finish.
const RUN_NOW_MINUTES = 0.5;

interface DemoRun {
  routine: DemoRoutine;
  outcome: DemoOutcome;
  id: string;
  trigger: RunTrigger;
  scheduledFor: Date | null;
  startedAt: Date;
  pid: number;
  sessionId: string;
}

interface ScheduledEvents {
  runs: DemoRun[];
  skips: Skip[];
}

export interface DemoHistory {
  listRuns(now: Date): RunRecord[];
  listSkips(routine: DemoRoutine, now: Date): Skip[];
  findRun(routine: string, id: string, now: Date): RunRecord | null;
  getTranscript(routine: string, id: string, now: Date): Transcript | null;
  startRun(routine: DemoRoutine, now: Date): void;
}

function fail(message: string): never {
  throw new Error(message);
}

function toRunId(startedAt: Date, random: Random): string {
  const stamp = startedAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${randomId(random, 4)}`;
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
    sessionId: randomUuid(random),
  };
}

function getDurationMs(run: DemoRun): number {
  return Math.round(run.outcome.minutes * 60_000);
}

function checkIsRunning(run: DemoRun, now: Date): boolean {
  return run.startedAt.getTime() + getDurationMs(run) > now.getTime();
}

function getExitCode(outcome: DemoOutcome): number | null {
  return match(outcome.status)
    .with('succeeded', () => 0)
    .with('failed', () => (outcome.exitCode === undefined ? 1 : outcome.exitCode))
    .with('timed_out', 'aborted', () => null)
    .exhaustive();
}

function getResumeCommand(agent: AgentName, sessionId: string): string | null {
  return match(agent)
    .with('claude', () => `claude --resume ${sessionId}`)
    .with('codex', () => `codex resume ${sessionId}`)
    .with('command', () => null)
    .exhaustive();
}

function buildSteps(run: DemoRun): TranscriptItem[] {
  return run.outcome.steps.map((step, index) => step(String(index)));
}

function toRunRecord(run: DemoRun, now: Date): RunRecord {
  const { routine, outcome } = run;
  const durationMs = getDurationMs(run);
  const isRunning = checkIsRunning(run, now);
  const hasSession =
    !isMatching({ agent: 'command' }, routine) &&
    buildSteps(run).some(isMatching({ kind: 'init' }));
  const sessionId = hasSession ? run.sessionId : null;
  const hasResult =
    !isRunning && isMatching({ agent: 'claude' }, routine) && outcome.numTurns !== undefined;
  return {
    id: run.id,
    routine: routine.name,
    agent: routine.agent,
    trigger: run.trigger,
    scheduledFor: run.scheduledFor?.toISOString() ?? null,
    startedAt: run.startedAt.toISOString(),
    endedAt: isRunning ? null : new Date(run.startedAt.getTime() + durationMs).toISOString(),
    status: isRunning ? 'running' : outcome.status,
    pid: run.pid,
    exitCode: isRunning ? null : getExitCode(outcome),
    sessionId,
    resumeCommand: sessionId === null ? null : getResumeCommand(routine.agent, sessionId),
    model: hasSession ? routine.runModel : null,
    costUsd: isRunning ? null : (outcome.costUsd ?? null),
    numTurns: isRunning ? null : (outcome.numTurns ?? null),
    durationMs: hasResult ? durationMs : null,
    resultText: isRunning ? null : (outcome.resultText ?? null),
    error: isRunning ? null : (outcome.error ?? null),
    logFile: `${STATE_DIR}/runs/${routine.name}/${run.id}.jsonl`,
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

// A running run shows the steps it has reached so far, with the last tool call still pending.
function getRunningItems(run: DemoRun, now: Date): TranscriptItem[] {
  const steps = buildSteps(run);
  const progress = (now.getTime() - run.startedAt.getTime()) / getDurationMs(run);
  const reached = steps.slice(0, Math.max(1, Math.ceil(progress * steps.length)));
  const last = reached.at(-1);
  if (last === undefined || !isMatching({ kind: 'tool' }, last)) return reached;
  return [...reached.slice(0, -1), { ...last, result: null }];
}

function buildTranscript(run: DemoRun, now: Date): Transcript {
  const record = toRunRecord(run, now);
  const items = checkIsRunning(run, now)
    ? getRunningItems(run, now)
    : [...buildSteps(run), ...getResultItems(record)];
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
  const buildStartedRuns = (
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
    ...buildStartedRuns(routine, 'manual', routine.manualRuns),
    ...buildStartedRuns(routine, 'webhook', routine.webhookRuns),
  ]);
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
    ].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  function findDemoRun(routine: string, id: string, now: Date): DemoRun | undefined {
    return listDemoRuns(now).find(run => run.routine.name === routine && run.id === id);
  }

  return {
    listRuns: now => listDemoRuns(now).map(run => toRunRecord(run, now)),
    listSkips: (routine, now) => getScheduledEvents(routine, now).skips.slice(-MAX_SKIPS),
    findRun(routine, id, now) {
      const run = findDemoRun(routine, id, now);
      return run === undefined ? null : toRunRecord(run, now);
    },
    getTranscript(routine, id, now) {
      const run = findDemoRun(routine, id, now);
      return run === undefined ? null : buildTranscript(run, now);
    },
    startRun(routine, now) {
      const random = createRandom(`${routine.name}:run-now:${now.toISOString()}`);
      const outcome = { ...pickOutcome(routine, random), minutes: RUN_NOW_MINUTES };
      startedRuns.push(createRun(routine, outcome, 'manual', null, now, random));
    },
  };
}
