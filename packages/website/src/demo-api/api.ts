import { isMatching, match, P } from 'ts-pattern';

import { buildCalendar } from 'domains/calendar/utils';
import type { DaemonStatus } from 'domains/daemon/types';
import { markReadRequestSchema, notifyRequestSchema } from 'domains/inbox/schemas';
import type { InboxState, NotifyLevels } from 'domains/inbox/types';
import { addReadRuns, changeNotifyLevel, listUnreadRuns } from 'domains/inbox/utils';
import type { ReleaseUpdate } from 'domains/release/types';
import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import { oneTimeRunRequestSchema } from 'domains/routine/schemas';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { RUNS_CURSOR_ERROR } from 'domains/run/constants';
import { runIdSchema, type RunId } from 'domains/run/ids';
import { runMessageSchema, usageLimitWaitActionSchema } from 'domains/run/schemas';
import type { RunRecord, TokenUsage } from 'domains/run/types';
import {
  buildTokenUsages,
  checkCanContinueRun,
  checkIsRunActive,
  checkIsRunAtWork,
  createRunId,
  filterRuns,
  findExpiredRuns,
  paginateRuns,
  parseRunsPageQuery,
} from 'domains/run/utils';
import { DEFAULT_SETTINGS } from 'domains/settings/constants';
import { settingsSchema } from 'domains/settings/schemas';
import type { Settings } from 'domains/settings/types';
import { webhookCallIdSchema } from 'domains/webhook/ids';
import type { QueuedWebhook, WebhookCall } from 'domains/webhook/types';
import { findExpiredWebhookCalls } from 'domains/webhook/utils';
import type { OneTimeRun, Skip } from 'domains/scheduler/types';
import {
  addOneTimeRun,
  checkHasOneTimeRun,
  getNextRunAt,
  getOneTimeRunError,
  listRoutineOneTimeRuns,
  removeOneTimeRun,
} from 'domains/scheduler/utils';
import { describeCron, nextCronRun } from 'utils/cron';

import { HOME, STATE_DIR } from './constants';
import { createDemoHistory } from './history';
import {
  demoRoutines,
  type DemoQueuedWebhook,
  type DemoRoutine,
  type DemoWebhookCall,
} from './routines';

export interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiRequest = [method: string, segments: string[]];

export interface DemoApi {
  respond(method: string, url: URL, body: string, now?: Date): ApiResponse;
}

const MAX_CALENDAR_DAYS = 32;
const DAEMON_UPTIME_MS = (3 * 24 + 4) * 3_600_000;
const TICK_MS = 30_000;
const MINUTE_MS = 60_000;
const LAST_LOOK_MS = 24 * 3_600_000;

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

// The public demo announces no update, so visitors never read of a release that does not exist.
const RELEASE_UPDATE: ReleaseUpdate = {
  installedVersion: null,
  releases: [],
  skippedVersion: null,
  updateCommand: null,
};

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

function toWebhookCall(
  receivedAt: Date,
  call: Omit<DemoWebhookCall, 'minutesAgo'>,
  runId: RunId | null,
): WebhookCall {
  return {
    id: webhookCallIdSchema.parse(String(receivedAt.getTime()).padStart(15, '0')),
    receivedAt: receivedAt.toISOString(),
    outcome: call.outcome,
    status: call.status,
    runId,
    reason: call.reason ?? null,
    bytes: new TextEncoder().encode(call.payload).length,
    preview: call.payload,
  };
}

function toOneTimeRun(routine: DemoRoutine, minutesAhead: number, loadedAt: Date): OneTimeRun {
  const at = new Date(loadedAt.getTime() + minutesAhead * MINUTE_MS);
  at.setSeconds(0, 0);
  return { routine: routine.name, at: at.toISOString() };
}

function toRoutineSummary(
  routine: DemoRoutine,
  runs: RunRecord[],
  skips: Skip[],
  queue: QueuedWebhook[],
  oneTimeRuns: OneTimeRun[],
  tokenUsage: TokenUsage | null,
  now: Date,
): RoutineSummary {
  const { schedule, enabled } = routine;
  const nextCronRunAt =
    schedule === null ? null : (nextCronRun(schedule, now)?.toISOString() ?? null);
  return {
    name: routine.name,
    description: routine.description,
    schedule,
    scheduleHuman: schedule === null ? 'Manual' : describeCron(schedule),
    nextRunAt: enabled ? getNextRunAt(nextCronRunAt, oneTimeRuns) : null,
    enabled,
    webhook: routine.webhook ?? false,
    webhookGate: routine.webhookGate ?? null,
    queuedWebhooks: queue.length,
    agent: routine.agent,
    model: routine.model,
    fallbackModel: routine.fallbackModel ?? null,
    effort: routine.effort,
    permissionMode: routine.permissionMode,
    command: routine.command,
    cwd: routine.cwd,
    timeoutMinutes: routine.timeoutMinutes,
    maxBudgetUsd: routine.maxBudgetUsd,
    file: `routines/${routine.name}.md`,
    running: runs.some(checkIsRunActive),
    lastRun: runs[0] ?? null,
    lastSkip: skips.at(-1) ?? null,
    tokenUsage,
  };
}

export function createDemoApi(loadedAt = new Date()): DemoApi {
  const history = createDemoHistory(demoRoutines, loadedAt);
  const daemonStartedAt = new Date(loadedAt.getTime() - DAEMON_UPTIME_MS);
  const fromLoad = (minutes: number) =>
    new Date(loadedAt.getTime() + minutes * MINUTE_MS).toISOString();
  let settings: Settings = DEFAULT_SETTINGS;
  let inbox: InboxState = {
    since: new Date(loadedAt.getTime() - LAST_LOOK_MS).toISOString(),
    readRuns: [],
  };
  let notify: NotifyLevels = {};
  let oneTimeRuns = demoRoutines
    .flatMap(routine =>
      (routine.oneTimeRuns ?? []).map(({ minutesAhead }) =>
        toOneTimeRun(routine, minutesAhead, loadedAt),
      ),
    )
    .reduce((runs: OneTimeRun[], run) => addOneTimeRun(runs, run), []);
  const queues = new Map(
    demoRoutines.map(routine => [
      routine.name,
      (routine.queuedWebhooks ?? []).map(webhook => toQueuedWebhook(webhook, loadedAt)),
    ]),
  );

  function listRuns(now: Date): RunRecord[] {
    const runs = history.listRuns(now);
    if (settings.runRetentionDays === null) return runs;
    const expired = new Set(findExpiredRuns(runs, settings.runRetentionDays, now));
    return runs.filter(run => !expired.has(run));
  }

  function findRun(routine: RoutineName, id: RunId, now: Date): RunRecord | null {
    return listRuns(now).find(run => run.routine === routine && run.id === id) ?? null;
  }

  function listRoutineRuns(routine: DemoRoutine, now: Date): RunRecord[] {
    return listRuns(now).filter(run => run.routine === routine.name);
  }

  function listQueue(routine: DemoRoutine, now: Date): QueuedWebhook[] {
    const isRunning = listRoutineRuns(routine, now).some(checkIsRunActive);
    return isRunning ? (queues.get(routine.name) ?? []) : [];
  }

  function listWebhookCalls(routine: DemoRoutine, now: Date): WebhookCall[] {
    const runs = listRoutineRuns(routine, now);
    const started = (routine.webhookRuns ?? []).flatMap(({ minutesAgo, payload = '' }) => {
      const receivedAt = new Date(loadedAt.getTime() - minutesAgo * MINUTE_MS);
      const run = runs.find(candidate =>
        match(candidate.trigger)
          .with('webhook', () => candidate.startedAt === receivedAt.toISOString())
          .otherwise(() => false),
      );
      return run === undefined
        ? []
        : [toWebhookCall(receivedAt, { outcome: 'started', status: 200, payload }, run.id)];
    });
    const queued = listQueue(routine, now).map(webhook =>
      toWebhookCall(
        new Date(webhook.queuedAt),
        { outcome: 'queued', status: 200, payload: webhook.preview },
        webhook.runId,
      ),
    );
    const others = (routine.webhookCalls ?? []).map(({ minutesAgo, ...call }) =>
      toWebhookCall(new Date(loadedAt.getTime() - minutesAgo * MINUTE_MS), call, null),
    );
    const calls = [...started, ...queued, ...others].sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt),
    );
    if (settings.runRetentionDays === null) return calls;
    const expired = new Set(findExpiredWebhookCalls(calls, settings.runRetentionDays, now));
    return calls.filter(call => !expired.has(call));
  }

  function getTokenUsages(now: Date): Map<RoutineName, TokenUsage | null> {
    const runs = listRuns(now);
    const usages = buildTokenUsages(
      demoRoutines.map(routine => runs.filter(run => run.routine === routine.name)),
      now,
    );
    return new Map(demoRoutines.map((routine, index) => [routine.name, usages[index] ?? null]));
  }

  function getSummary(
    routine: DemoRoutine,
    now: Date,
    tokenUsages = getTokenUsages(now),
  ): RoutineSummary {
    return toRoutineSummary(
      routine,
      listRoutineRuns(routine, now),
      history.listSkips(routine, now),
      listQueue(routine, now),
      listRoutineOneTimeRuns(oneTimeRuns, routine.name),
      tokenUsages.get(routine.name) ?? null,
      now,
    );
  }

  function withRoutine(
    name: RoutineName,
    respond: (routine: DemoRoutine) => ApiResponse,
  ): ApiResponse {
    const routine = demoRoutines.find(candidate => candidate.name === name);
    return routine === undefined ? fail(404, `Unknown routine ${name}`) : respond(routine);
  }

  function getStatus(now: Date): DaemonStatus {
    const running = listRuns(now).filter(checkIsRunAtWork).length;
    return {
      pid: 48213,
      startedAt: daemonStartedAt.toISOString(),
      lastTickAt: new Date(Math.floor(now.getTime() / TICK_MS) * TICK_MS).toISOString(),
      routinesDir: `${HOME}/kombinat/routines`,
      stateDir: STATE_DIR,
      claudeBin: `${HOME}/.local/bin/claude`,
      codexBin: '/opt/homebrew/bin/codex',
      maxConcurrentRuns: 2,
      running,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now: now.toISOString(),
      disk: { freeBytes: 182_400_000_000, totalBytes: 494_380_000_000 },
      cpuLoad: running > 0 ? 0.46 : 0.07,
      claudeUsage: {
        updatedAt: fromLoad(-6),
        session: { usedRatio: 0.34, resetsAt: fromLoad(2 * 60 + 14) },
        week: { usedRatio: 0.58, resetsAt: fromLoad((3 * 24 + 5) * 60) },
      },
    };
  }

  function getRoutineDetail(routine: DemoRoutine, now: Date): RoutineDetail {
    return {
      ...getSummary(routine, now),
      prompt: routine.prompt,
      skips: history.listSkips(routine, now),
      queue: listQueue(routine, now),
      webhookCalls: listWebhookCalls(routine, now),
      oneTimeRuns: listRoutineOneTimeRuns(oneTimeRuns, routine.name),
    };
  }

  // The daemon's tick, run on each request instead of every 30 s.
  function startDueOneTimeRuns(now: Date): void {
    for (const oneTimeRun of oneTimeRuns) {
      const scheduledFor = new Date(oneTimeRun.at);
      if (scheduledFor > now) continue;
      const routine = demoRoutines.find(candidate => candidate.name === oneTimeRun.routine);
      if (routine === undefined || !routine.enabled) {
        oneTimeRuns = removeOneTimeRun(oneTimeRuns, oneTimeRun);
        continue;
      }
      if (listRoutineRuns(routine, now).some(checkIsRunActive)) continue;
      history.startRun(routine, now, scheduledFor);
      oneTimeRuns = removeOneTimeRun(oneTimeRuns, oneTimeRun);
    }
  }

  function parseOneTimeRun(routine: DemoRoutine, body: string): OneTimeRun | null {
    const request = oneTimeRunRequestSchema.safeParse(parseJson(body));
    if (!request.success) return null;
    return { routine: routine.name, at: new Date(request.data.at).toISOString() };
  }

  function scheduleOneTimeRun(routine: DemoRoutine, body: string, now: Date): ApiResponse {
    const oneTimeRun = parseOneTimeRun(routine, body);
    if (oneTimeRun === null) return fail(400, 'The body must be JSON with an ISO time in at');
    if (!routine.enabled) {
      return fail(409, `${routine.name} is disabled, set enabled: true in its frontmatter`);
    }
    const error = getOneTimeRunError(oneTimeRuns, oneTimeRun, now);
    if (error !== null) return fail(400, error);
    oneTimeRuns = addOneTimeRun(oneTimeRuns, oneTimeRun);
    return ok({ ok: true });
  }

  function cancelOneTimeRun(routine: DemoRoutine, body: string): ApiResponse {
    const oneTimeRun = parseOneTimeRun(routine, body);
    if (oneTimeRun === null) return fail(400, 'The body must be JSON with an ISO time in at');
    if (!checkHasOneTimeRun(oneTimeRuns, oneTimeRun)) {
      return fail(
        404,
        `${routine.name} has no run scheduled at that time, it may have started already`,
      );
    }
    oneTimeRuns = removeOneTimeRun(oneTimeRuns, oneTimeRun);
    return ok({ ok: true });
  }

  function startRun(routine: DemoRoutine, now: Date): ApiResponse {
    if (listRoutineRuns(routine, now).some(checkIsRunActive)) {
      return fail(409, `${routine.name} is already running`);
    }
    return { status: 202, body: { ok: true, runId: history.startRun(routine, now) } };
  }

  function sendMessage(routine: DemoRoutine, run: RunRecord, body: string, now: Date): ApiResponse {
    const message = runMessageSchema.safeParse(parseJson(body));
    if (!message.success) return fail(400, 'The message needs text');
    if (!checkCanContinueRun(run)) {
      return fail(409, `This ${run.agent} run has no session to continue`);
    }
    if (listRoutineRuns(routine, now).some(checkIsRunActive)) {
      return fail(409, `${routine.name} is running, send the message once it is done`);
    }
    history.sendMessage(routine.name, run.id, message.data.text, now);
    return { status: 202, body: { ok: true } };
  }

  function sendWaitAction(run: RunRecord, action: string, now: Date): ApiResponse {
    const parsed = usageLimitWaitActionSchema.safeParse(action);
    if (!parsed.success) return fail(404, 'Not found');
    if (!isMatching({ status: 'waiting' }, run)) {
      return fail(409, 'This run is not waiting for a usage limit');
    }
    history.sendWaitAction(run.routine, run.id, parsed.data, now);
    return { status: 202, body: { ok: true } };
  }

  function getRunsPage(url: URL, now: Date): ApiResponse {
    const query = parseRunsPageQuery(url.searchParams);
    if (query === null) return fail(400, RUNS_CURSOR_ERROR);
    const toPage = (runs: RunRecord[]) =>
      ok(paginateRuns(filterRuns(runs, query.search), query.cursor));
    if (query.routine === null) return toPage(listRuns(now));
    return withRoutine(query.routine, routine => toPage(listRoutineRuns(routine, now)));
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
    return ok(buildCalendar(demoRoutines, listRuns(now), oneTimeRuns, from, to, now));
  }

  function updateSettings(body: string): ApiResponse {
    const parsed = settingsSchema.safeParse(parseJson(body));
    if (!parsed.success) {
      return fail(400, 'runRetentionDays must be a whole number of days or null');
    }
    settings = parsed.data;
    return ok(settings);
  }

  function markRunsRead(body: string, now: Date): ApiResponse {
    const request = markReadRequestSchema.safeParse(parseJson(body));
    if (!request.success) return fail(400, 'The body must list runs with their routine and id');
    inbox = addReadRuns(inbox, request.data.runs, listRuns(now));
    return ok({ ok: true });
  }

  function setNotifyLevel(routine: DemoRoutine, body: string): ApiResponse {
    const request = notifyRequestSchema.safeParse(parseJson(body));
    if (!request.success) {
      return fail(400, 'level must be failures_and_findings, failures, every_run or never');
    }
    notify = changeNotifyLevel(notify, routine.name, request.data.level);
    return ok({ ok: true });
  }

  function routeApi(request: ApiRequest, url: URL, body: string, now: Date): ApiResponse {
    return match(request)
      .with(['GET', ['status']], () => ok(getStatus(now)))
      .with(['GET', ['routines']], () => {
        const tokenUsages = getTokenUsages(now);
        return ok(demoRoutines.map(routine => getSummary(routine, now, tokenUsages)));
      })
      .with(['GET', ['routines', P.string]], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => ok(getRoutineDetail(routine, now))),
      )
      .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => startRun(routine, now)),
      )
      .with(['POST', ['routines', P.string, 'one-time-runs']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine =>
          scheduleOneTimeRun(routine, body, now),
        ),
      )
      .with(['POST', ['routines', P.string, 'one-time-runs', 'cancel']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => cancelOneTimeRun(routine, body)),
      )
      .with(['GET', ['calendar']], () => getCalendar(url, now))
      .with(['GET', ['inbox']], () => ok({ runs: listUnreadRuns(listRuns(now), inbox), notify }))
      .with(['POST', ['inbox', 'read']], () => markRunsRead(body, now))
      .with(['PUT', ['inbox', 'notify', P.string]], ([, [, , name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => setNotifyLevel(routine, body)),
      )
      .with(['GET', ['settings']], () => ok(settings))
      .with(['PUT', ['settings']], () => updateSettings(body))
      .with(['GET', ['releases']], () => ok(RELEASE_UPDATE))
      .with(['GET', ['runs']], () => getRunsPage(url, now))
      .with(['GET', ['runs', P.string, P.string]], ([, [, routine, id]]) => {
        const run = findRun(routineNameSchema.parse(routine), runIdSchema.parse(id), now);
        return run === null ? fail(404, 'Run not found') : ok(run);
      })
      .with(['POST', ['runs', P.string, P.string, 'messages']], ([, [, name, id]]) =>
        withRoutine(routineNameSchema.parse(name), routine => {
          const run = findRun(routine.name, runIdSchema.parse(id), now);
          return run === null ? fail(404, 'Run not found') : sendMessage(routine, run, body, now);
        }),
      )
      .with(
        ['POST', ['runs', P.string, P.string, 'wait', P.string]],
        ([, [, name, id, , action]]) =>
          withRoutine(routineNameSchema.parse(name), routine => {
            const run = findRun(routine.name, runIdSchema.parse(id), now);
            return run === null ? fail(404, 'Run not found') : sendWaitAction(run, action, now);
          }),
      )
      .with(['GET', ['runs', P.string, P.string, 'transcript']], ([, [, routine, id]]) => {
        const run = findRun(routineNameSchema.parse(routine), runIdSchema.parse(id), now);
        const transcript = run && history.getTranscript(run.routine, run.id, now);
        return transcript === null ? fail(404, 'Run not found') : ok(transcript);
      })
      .otherwise(() => fail(404, 'Not found'));
  }

  return {
    respond(method, url, body, now = new Date()) {
      const segments = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
      startDueOneTimeRuns(now);
      return routeApi([method, segments], url, body, now);
    },
  };
}
