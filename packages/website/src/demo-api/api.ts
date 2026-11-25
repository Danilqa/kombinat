import { match, P } from 'ts-pattern';

import { CLAUDE_MODELS } from 'domains/agent/constants';
import type { AgentOption } from 'domains/agent/types';
import { buildCalendar } from 'domains/calendar/utils';
import type { DaemonStatus } from 'domains/daemon/types';
import { NOTIFY_LEVELS } from 'domains/inbox/constants';
import { markReadRequestSchema, notifyRequestSchema } from 'domains/inbox/schemas';
import type { InboxState, NotifyLevels } from 'domains/inbox/types';
import { addReadRuns, changeNotifyLevel, listUnreadRuns } from 'domains/inbox/utils';
import { INSIGHTS_PERIOD_ERROR } from 'domains/insights/constants';
import { buildInsights, parseInsightsPeriod } from 'domains/insights/utils';
import type { ReleaseUpdate } from 'domains/release/types';
import { MEMORY_MAX_LENGTH } from 'domains/routine/constants';
import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import {
  addRoutineRequestSchema,
  memoryRequestSchema,
  oneTimeRunRequestSchema,
  startRunRequestSchema,
} from 'domains/routine/schemas';
import { findRoutineTemplate } from 'domains/routine/templates';
import type { RoutineDetail, RoutineMemory, RoutineSummary } from 'domains/routine/types';
import { AGENT_KIND_ERROR } from 'domains/routine/constants';
import { checkCanUseAgent, countChangedLines, describeScheduleValue } from 'domains/routine/utils';
import { MAX_RUNS, RUNS_CURSOR_ERROR } from 'domains/run/constants';
import { runIdSchema, type RunId } from 'domains/run/ids';
import { runMessageSchema, usageLimitWaitActionSchema } from 'domains/run/schemas';
import type { QueuedRun, RunRecord, TokenUsage } from 'domains/run/types';
import {
  buildAllowMessage,
  buildTokenUsages,
  checkCanContinueRun,
  checkIsRunActive,
  checkIsRunWaiting,
  checkIsRunAtWork,
  createRunId,
  filterRuns,
  findExpiredRuns,
  listBlockedRules,
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
import { toTemplateRoutine } from './templates';

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

const AGENT_OPTIONS: AgentOption[] = [
  { name: 'claude', isInstalled: true, models: CLAUDE_MODELS },
  { name: 'codex', isInstalled: true, models: ['gpt-5.5', 'gpt-5.4'] },
];

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
  hasQueuedRuns: boolean,
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
    check: routine.check?.command ?? null,
    queuedWebhooks: queue.length,
    agent: routine.agent,
    model: routine.model,
    fallbackModel: routine.fallbackModel ?? null,
    effort: routine.effort,
    permissionMode: routine.permissionMode,
    command: routine.command,
    cwd: routine.cwd,
    timeoutMinutes: routine.timeoutMinutes,
    retries: routine.retries ?? 0,
    runs: routine.runs ?? 1,
    maxParallel: routine.maxParallel ?? 1,
    worktree: routine.worktree ?? false,
    maxBudgetUsd: routine.maxBudgetUsd,
    maxBudgetTokens: routine.maxBudgetTokens ?? null,
    file: `routines/${routine.name}.md`,
    running: hasQueuedRuns || runs.some(checkIsRunActive),
    lastRun: runs[0] ?? null,
    lastSkip: skips.at(-1) ?? null,
    tokenUsage,
    memory: checkHasMemory(routine),
  };
}

// Stands in for memory: true, which only the routines with sample notes have.
function checkHasMemory(routine: DemoRoutine): boolean {
  return routine.memory !== undefined;
}

function getMemoryFile(routine: DemoRoutine): string {
  return `${STATE_DIR}/memory/${routine.name}.md`;
}

// The sample notes come from the last run that finished before the visitor came.
function toDemoMemory(routine: DemoRoutine, runs: RunRecord[]): RoutineMemory {
  const lastRun = runs.find(run => run.routine === routine.name && run.endedAt !== null);
  const file = getMemoryFile(routine);
  if (routine.memory === undefined || lastRun === undefined || lastRun.endedAt === null) {
    return { text: '', file, change: null };
  }
  const { text, added, removed } = routine.memory;
  return {
    text,
    file,
    change: { at: lastRun.endedAt, by: 'run', runId: lastRun.id, added, removed },
  };
}

export function createDemoApi(loadedAt = new Date()): DemoApi {
  const routines = [...demoRoutines];
  const history = createDemoHistory(routines, loadedAt);
  const daemonStartedAt = new Date(loadedAt.getTime() - DAEMON_UPTIME_MS);
  const fromLoad = (minutes: number) =>
    new Date(loadedAt.getTime() + minutes * MINUTE_MS).toISOString();
  let settings: Settings = DEFAULT_SETTINGS;
  let inbox: InboxState = {
    since: new Date(loadedAt.getTime() - LAST_LOOK_MS).toISOString(),
    readRuns: [],
  };
  let notify: NotifyLevels = {};
  let queuedRuns: QueuedRun[] = [];
  let oneTimeRuns = routines
    .flatMap(routine =>
      (routine.oneTimeRuns ?? []).map(({ minutesAhead }) =>
        toOneTimeRun(routine, minutesAhead, loadedAt),
      ),
    )
    .reduce((runs: OneTimeRun[], run) => addOneTimeRun(runs, run), []);
  const memories = new Map(
    routines.map(routine => [routine.name, toDemoMemory(routine, history.listRuns(loadedAt))]),
  );
  const queues = new Map(
    routines.map(routine => [
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

  function listQueue(routine: DemoRoutine, routineRuns: RunRecord[]): QueuedWebhook[] {
    const isRunning = routineRuns.some(checkIsRunActive);
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
    const queued = listQueue(routine, runs).map(webhook =>
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

  function getTokenUsages(now: Date, runs = listRuns(now)): Map<RoutineName, TokenUsage | null> {
    const usages = buildTokenUsages(
      routines.map(routine => runs.filter(run => run.routine === routine.name)),
      now,
    );
    return new Map(routines.map((routine, index) => [routine.name, usages[index] ?? null]));
  }

  // Takes the runs of all routines, so a list of summaries builds them once.
  function getSummary(
    routine: DemoRoutine,
    now: Date,
    runs = listRuns(now),
    tokenUsages = getTokenUsages(now, runs),
  ): RoutineSummary {
    const routineRuns = runs.filter(run => run.routine === routine.name);
    return toRoutineSummary(
      routine,
      routineRuns,
      history.listSkips(routine, now),
      listQueue(routine, routineRuns),
      listRoutineOneTimeRuns(oneTimeRuns, routine.name),
      tokenUsages.get(routine.name) ?? null,
      queuedRuns.some(queued => queued.routine === routine.name),
      now,
    );
  }

  function withRoutine(
    name: RoutineName,
    respond: (routine: DemoRoutine) => ApiResponse,
  ): ApiResponse {
    const routine = routines.find(candidate => candidate.name === name);
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
      queue: listQueue(routine, listRoutineRuns(routine, now)),
      webhookCalls: listWebhookCalls(routine, now),
      oneTimeRuns: listRoutineOneTimeRuns(oneTimeRuns, routine.name),
      queuedRuns: queuedRuns.filter(queued => queued.routine === routine.name),
      memoryNotes: checkHasMemory(routine) ? (memories.get(routine.name) ?? null) : null,
    };
  }

  // The daemon's tick, run on each request instead of every 30 s.
  function startDueOneTimeRuns(now: Date): void {
    for (const oneTimeRun of oneTimeRuns) {
      const scheduledFor = new Date(oneTimeRun.at);
      if (scheduledFor > now) continue;
      const routine = routines.find(candidate => candidate.name === oneTimeRun.routine);
      if (routine === undefined || !routine.enabled) {
        oneTimeRuns = removeOneTimeRun(oneTimeRuns, oneTimeRun);
        continue;
      }
      if (listRoutineRuns(routine, now).some(checkIsRunActive)) continue;
      history.startRun(routine, now, scheduledFor);
      oneTimeRuns = removeOneTimeRun(oneTimeRuns, oneTimeRun);
    }
  }

  // The daemon's tick for the runs of a start that wait for a slot.
  function startQueuedRuns(now: Date): void {
    for (const queued of queuedRuns) {
      const routine = routines.find(candidate => candidate.name === queued.routine);
      if (routine === undefined) continue;
      const activeCount = listRoutineRuns(routine, now).filter(checkIsRunActive).length;
      if (activeCount >= queued.maxParallel) continue;
      history.startRun(routine, now);
      queuedRuns = queuedRuns.filter(candidate => candidate !== queued);
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

  function saveMemory(routine: DemoRoutine, body: string, now: Date): ApiResponse {
    if (!checkHasMemory(routine)) {
      return fail(
        409,
        `${routine.name} has no memory. It needs agent claude or codex and memory: true`,
      );
    }
    const request = memoryRequestSchema.safeParse(parseJson(body));
    if (!request.success) {
      return fail(
        400,
        `The body must be JSON with notes of at most ${MEMORY_MAX_LENGTH} characters in text`,
      );
    }
    const before = memories.get(routine.name)?.text ?? '';
    const text = request.data.text.replace(/\r\n/g, '\n').trim();
    if (text !== before) {
      memories.set(routine.name, {
        text,
        file: getMemoryFile(routine),
        change: {
          at: now.toISOString(),
          by: 'user',
          runId: null,
          ...countChangedLines(before, text),
        },
      });
    }
    return ok({ ok: true });
  }

  function addRoutine(body: string, now: Date): ApiResponse {
    const request = addRoutineRequestSchema.safeParse(parseJson(body));
    if (!request.success) {
      return fail(
        400,
        'The body must be JSON with a template, a lowercase kebab-case name, a folder, a schedule, an agent, a model or null and a prompt',
      );
    }
    const { template: id, ...choices } = request.data;
    const template = findRoutineTemplate(id);
    if (template === null) return fail(404, `Unknown template ${id}`);
    if (!checkCanUseAgent(template, choices.agent)) return fail(400, AGENT_KIND_ERROR);
    if (describeScheduleValue(choices.schedule) === null) {
      return fail(400, `${choices.schedule} is not a cron schedule or manual`);
    }
    const name = routineNameSchema.parse(choices.name);
    if (routines.some(routine => routine.name === name)) {
      return fail(409, `A routine named ${name} already exists. Choose another name`);
    }
    const routine = toTemplateRoutine(template, { ...choices, name });
    routines.push(routine);
    history.addRoutine(routine, now);
    if (template.memory)
      memories.set(name, { text: '', file: getMemoryFile(routine), change: null });
    return { status: 201, body: { ok: true, name, file: `routines/${name}.md` } };
  }

  function startRun(routine: DemoRoutine, body: string, now: Date): ApiResponse {
    const request = body === '' ? null : startRunRequestSchema.safeParse(parseJson(body));
    if (request?.success === false) {
      return fail(
        400,
        `The body must be JSON, with a prompt that isn't blank and runs and maxParallel from 1 to ${MAX_RUNS}`,
      );
    }
    const runs = request?.data.runs ?? routine.runs ?? 1;
    const maxParallel = request?.data.maxParallel ?? Math.min(routine.maxParallel ?? 1, runs);
    if (maxParallel > runs) return fail(400, `maxParallel must be at most runs, which is ${runs}`);
    const isQueued = queuedRuns.some(queued => queued.routine === routine.name);
    if (isQueued || listRoutineRuns(routine, now).some(checkIsRunActive)) {
      return fail(409, `${routine.name} is already running`);
    }
    const runId = history.startRun(routine, now);
    queuedRuns = [
      ...queuedRuns,
      ...Array.from({ length: runs - 1 }, () => ({
        routine: routine.name,
        id: createRunId(now),
        trigger: 'manual' as const,
        scheduledFor: null,
        maxParallel,
        queuedAt: now.toISOString(),
      })),
    ];
    startQueuedRuns(now);
    return { status: 202, body: { ok: true, runId } };
  }

  function cancelQueuedRuns(routine: DemoRoutine): ApiResponse {
    queuedRuns = queuedRuns.filter(queued => queued.routine !== routine.name);
    return ok({ ok: true });
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

  function allowBlockedActions(routine: DemoRoutine, run: RunRecord, now: Date): ApiResponse {
    const rules = listBlockedRules(run.blockedActions);
    if (rules.length === 0) return fail(409, 'This run has no blocked actions to allow');
    if (!checkCanContinueRun(run)) {
      return fail(409, `This ${run.agent} run has no session to continue`);
    }
    if (listRoutineRuns(routine, now).some(checkIsRunActive)) {
      return fail(409, `${routine.name} is running, try again once it is done`);
    }
    history.allowBlockedActions(routine.name, run.id, buildAllowMessage(rules), now);
    return { status: 202, body: { ok: true } };
  }

  function sendWaitAction(run: RunRecord, action: string, now: Date): ApiResponse {
    const parsed = usageLimitWaitActionSchema.safeParse(action);
    if (!parsed.success) return fail(404, 'Not found');
    if (!checkIsRunWaiting(run)) {
      return fail(409, 'This run is not waiting for a usage limit or a retry');
    }
    history.sendWaitAction(run.routine, run.id, parsed.data, now);
    return { status: 202, body: { ok: true } };
  }

  function removeWorktree(run: RunRecord): ApiResponse {
    if (run.worktree === null) return fail(404, 'This run has no worktree');
    if (checkIsRunActive(run)) {
      return fail(409, 'The run is still working in its worktree. Remove it once the run is done');
    }
    history.removeWorktree(run.routine, run.id);
    return ok({ ok: true });
  }

  function getRunsPage(url: URL, now: Date): ApiResponse {
    const query = parseRunsPageQuery(url.searchParams);
    if (query === null) return fail(400, RUNS_CURSOR_ERROR);
    const toPage = (runs: RunRecord[]) =>
      ok(paginateRuns(filterRuns(runs, query.search), query.cursor));
    if (query.routine === null) return toPage(listRuns(now));
    return withRoutine(query.routine, routine => toPage(listRoutineRuns(routine, now)));
  }

  function getInsights(url: URL, now: Date): ApiResponse {
    const days = parseInsightsPeriod(url.searchParams);
    if (days === null) return fail(400, INSIGHTS_PERIOD_ERROR);
    return ok(buildInsights(listRuns(now), days, now, settings.runRetentionDays));
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
    return ok(buildCalendar(routines, listRuns(now), oneTimeRuns, from, to, now));
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
      return fail(400, `level must be one of ${NOTIFY_LEVELS.join(', ')}`);
    }
    notify = changeNotifyLevel(notify, routine.name, request.data.level);
    return ok({ ok: true });
  }

  function routeApi(request: ApiRequest, url: URL, body: string, now: Date): ApiResponse {
    return match(request)
      .with(['GET', ['status']], () => ok(getStatus(now)))
      .with(['GET', ['routines']], () => {
        const runs = listRuns(now);
        const tokenUsages = getTokenUsages(now, runs);
        return ok(routines.map(routine => getSummary(routine, now, runs, tokenUsages)));
      })
      .with(['POST', ['routines']], () => addRoutine(body, now))
      .with(['GET', ['routines', P.string]], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => ok(getRoutineDetail(routine, now))),
      )
      .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => startRun(routine, body, now)),
      )
      .with(['POST', ['routines', P.string, 'queued-runs', 'cancel']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), cancelQueuedRuns),
      )
      .with(['POST', ['routines', P.string, 'one-time-runs']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine =>
          scheduleOneTimeRun(routine, body, now),
        ),
      )
      .with(['POST', ['routines', P.string, 'one-time-runs', 'cancel']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => cancelOneTimeRun(routine, body)),
      )
      .with(['PUT', ['routines', P.string, 'memory']], ([, [, name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => saveMemory(routine, body, now)),
      )
      .with(['GET', ['calendar']], () => getCalendar(url, now))
      .with(['GET', ['inbox']], () => ok({ runs: listUnreadRuns(listRuns(now), inbox), notify }))
      .with(['POST', ['inbox', 'read']], () => markRunsRead(body, now))
      .with(['GET', ['insights']], () => getInsights(url, now))
      .with(['PUT', ['inbox', 'notify', P.string]], ([, [, , name]]) =>
        withRoutine(routineNameSchema.parse(name), routine => setNotifyLevel(routine, body)),
      )
      .with(['GET', ['agents']], () => ok(AGENT_OPTIONS))
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
      .with(['POST', ['runs', P.string, P.string, 'blocked', 'allow']], ([, [, name, id]]) =>
        withRoutine(routineNameSchema.parse(name), routine => {
          const run = findRun(routine.name, runIdSchema.parse(id), now);
          return run === null ? fail(404, 'Run not found') : allowBlockedActions(routine, run, now);
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
      .with(['POST', ['runs', P.string, P.string, 'worktree', 'remove']], ([, [, routine, id]]) => {
        const run = findRun(routineNameSchema.parse(routine), runIdSchema.parse(id), now);
        return run === null ? fail(404, 'Run not found') : removeWorktree(run);
      })
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
      startQueuedRuns(now);
      return routeApi([method, segments], url, body, now);
    },
  };
}
