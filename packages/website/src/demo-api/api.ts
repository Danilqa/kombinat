import { isMatching, match, P } from 'ts-pattern';

import { buildCalendar } from 'domains/calendar/utils';
import type { DaemonStatus } from 'domains/daemon/types';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import type { RunRecord } from 'domains/run/types';
import { createRunId } from 'domains/run/utils';
import type { QueuedWebhook } from 'domains/webhook/types';
import type { Skip } from 'domains/scheduler/types';
import { describeCron, nextCronRun } from 'utils/cron';

import { HOME, STATE_DIR } from './constants';
import { createDemoHistory } from './history';
import { demoRoutines, type DemoQueuedWebhook, type DemoRoutine } from './routines';

export interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiRequest = [method: string, segments: string[]];

export interface DemoApi {
  respond(method: string, url: URL, now?: Date): ApiResponse;
}

const MAX_CALENDAR_DAYS = 32;
const DAEMON_UPTIME_MS = (3 * 24 + 4) * 3_600_000;
const TICK_MS = 30_000;

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } });

function toQueuedWebhook(
  { minutesAgo, payload }: DemoQueuedWebhook,
  loadedAt: Date,
): QueuedWebhook {
  const queuedAt = new Date(loadedAt.getTime() - minutesAgo * 60_000);
  return {
    runId: createRunId(queuedAt),
    queuedAt: queuedAt.toISOString(),
    bytes: new TextEncoder().encode(payload).length,
    preview: payload,
  };
}

function toRoutineSummary(
  routine: DemoRoutine,
  runs: RunRecord[],
  skips: Skip[],
  queue: QueuedWebhook[],
  now: Date,
): RoutineSummary {
  const { schedule, enabled } = routine;
  return {
    name: routine.name,
    description: routine.description,
    schedule,
    scheduleHuman: schedule === null ? 'Manual' : describeCron(schedule),
    nextRunAt:
      schedule === null || !enabled ? null : (nextCronRun(schedule, now)?.toISOString() ?? null),
    enabled,
    webhook: routine.webhook ?? false,
    webhookGate: routine.webhookGate ?? null,
    queuedWebhooks: queue.length,
    agent: routine.agent,
    model: routine.model,
    effort: routine.effort,
    permissionMode: routine.permissionMode,
    command: routine.command,
    cwd: routine.cwd,
    timeoutMinutes: routine.timeoutMinutes,
    maxBudgetUsd: routine.maxBudgetUsd,
    file: `routines/${routine.name}.md`,
    running: runs.some(isMatching({ status: 'running' })),
    lastRun: runs[0] ?? null,
    lastSkip: skips.at(-1) ?? null,
  };
}

export function createDemoApi(loadedAt = new Date()): DemoApi {
  const history = createDemoHistory(demoRoutines, loadedAt);
  const daemonStartedAt = new Date(loadedAt.getTime() - DAEMON_UPTIME_MS);
  const queues = new Map(
    demoRoutines.map(routine => [
      routine.name,
      (routine.queuedWebhooks ?? []).map(webhook => toQueuedWebhook(webhook, loadedAt)),
    ]),
  );

  function listRoutineRuns(routine: DemoRoutine, now: Date): RunRecord[] {
    return history.listRuns(now).filter(run => run.routine === routine.name);
  }

  function listQueue(routine: DemoRoutine, now: Date): QueuedWebhook[] {
    const isRunning = listRoutineRuns(routine, now).some(isMatching({ status: 'running' }));
    return isRunning ? (queues.get(routine.name) ?? []) : [];
  }

  function getSummary(routine: DemoRoutine, now: Date): RoutineSummary {
    return toRoutineSummary(
      routine,
      listRoutineRuns(routine, now),
      history.listSkips(routine, now),
      listQueue(routine, now),
      now,
    );
  }

  function withRoutine(name: string, respond: (routine: DemoRoutine) => ApiResponse): ApiResponse {
    const routine = demoRoutines.find(candidate => candidate.name === name);
    return routine === undefined ? fail(404, `Unknown routine ${name}`) : respond(routine);
  }

  function getStatus(now: Date): DaemonStatus {
    return {
      pid: 48213,
      startedAt: daemonStartedAt.toISOString(),
      lastTickAt: new Date(Math.floor(now.getTime() / TICK_MS) * TICK_MS).toISOString(),
      routinesDir: `${HOME}/kombinat/routines`,
      stateDir: STATE_DIR,
      claudeBin: `${HOME}/.local/bin/claude`,
      codexBin: '/opt/homebrew/bin/codex',
      maxConcurrentRuns: 2,
      running: history.listRuns(now).filter(isMatching({ status: 'running' })).length,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now: now.toISOString(),
    };
  }

  function getRoutineDetail(routine: DemoRoutine, now: Date): RoutineDetail {
    return {
      ...getSummary(routine, now),
      prompt: routine.prompt,
      runs: listRoutineRuns(routine, now),
      skips: history.listSkips(routine, now),
      queue: listQueue(routine, now),
    };
  }

  function startRun(routine: DemoRoutine, now: Date): ApiResponse {
    if (listRoutineRuns(routine, now).some(isMatching({ status: 'running' }))) {
      return fail(409, `${routine.name} is already running`);
    }
    history.startRun(routine, now);
    return { status: 202, body: { ok: true } };
  }

  function getCalendar(url: URL, now: Date): ApiResponse {
    const from = new Date(url.searchParams.get('from') ?? '');
    const to = new Date(url.searchParams.get('to') ?? '');
    const isValid =
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      to > from &&
      to.getTime() - from.getTime() <= MAX_CALENDAR_DAYS * 86_400_000;
    if (!isValid) {
      return fail(400, `from and to must be ISO dates spanning at most ${MAX_CALENDAR_DAYS} days`);
    }
    return ok(buildCalendar(demoRoutines, history.listRuns(now), from, to, now));
  }

  function routeApi(request: ApiRequest, url: URL, now: Date): ApiResponse {
    return match(request)
      .with(['GET', ['status']], () => ok(getStatus(now)))
      .with(['GET', ['routines']], () => ok(demoRoutines.map(routine => getSummary(routine, now))))
      .with(['GET', ['routines', P.string]], ([, [, name]]) =>
        withRoutine(name, routine => ok(getRoutineDetail(routine, now))),
      )
      .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) =>
        withRoutine(name, routine => startRun(routine, now)),
      )
      .with(['GET', ['calendar']], () => getCalendar(url, now))
      .with(['GET', ['runs']], () =>
        ok(
          history
            .listRuns(now)
            .slice(0, Number(url.searchParams.get('limit') ?? RECENT_RUNS_LIMIT)),
        ),
      )
      .with(['GET', ['runs', P.string, P.string]], ([, [, routine, id]]) => {
        const run = history.findRun(routine, id, now);
        return run === null ? fail(404, 'Run not found') : ok(run);
      })
      .with(['GET', ['runs', P.string, P.string, 'transcript']], ([, [, routine, id]]) => {
        const transcript = history.getTranscript(routine, id, now);
        return transcript === null ? fail(404, 'Run not found') : ok(transcript);
      })
      .otherwise(() => fail(404, 'Not found'));
  }

  return {
    respond(method, url, now = new Date()) {
      const segments = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
      return routeApi([method, segments], url, now);
    },
  };
}
