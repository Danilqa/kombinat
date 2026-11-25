import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { isMatching, match, P } from 'ts-pattern';

import { buildCalendar } from 'domains/calendar/utils';
import type { DaemonStatus } from 'domains/daemon/types';
import { NOTIFY_LEVELS } from 'domains/inbox/constants';
import { markReadRequestSchema, notifyRequestSchema } from 'domains/inbox/schemas';
import {
  addReadRuns,
  changeNotifyLevel,
  keepNotifyLevelsOf,
  listUnreadRuns,
} from 'domains/inbox/utils';
import { INSIGHTS_PERIOD_ERROR } from 'domains/insights/constants';
import { buildInsights, parseInsightsPeriod } from 'domains/insights/utils';
import { releaseVersionSchema } from 'domains/release/ids';
import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import { MEMORY_MAX_LENGTH } from 'domains/routine/constants';
import {
  memoryRequestSchema,
  oneTimeRunRequestSchema,
  startRunRequestSchema,
} from 'domains/routine/schemas';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { MAX_RUNS, RUNS_CURSOR_ERROR } from 'domains/run/constants';
import { runIdSchema, type RunId } from 'domains/run/ids';
import { runMessageSchema, usageLimitWaitActionSchema } from 'domains/run/schemas';
import type { RunRecord, TokenUsage } from 'domains/run/types';
import {
  buildAllowMessage,
  buildTokenUsages,
  checkCanContinueRun,
  checkIsRunActive,
  checkIsRunAtWork,
  checkIsRunWaiting,
  filterRuns,
  getTokenUsageStart,
  listBlockedRules,
  paginateRuns,
  parseRunsPageQuery,
} from 'domains/run/utils';
import type { OneTimeRun } from 'domains/scheduler/types';
import {
  addOneTimeRun,
  checkHasOneTimeRun,
  getNextRunAt,
  getOneTimeRunError,
  listRoutineOneTimeRuns,
  removeOneTimeRun,
} from 'domains/scheduler/utils';
import { settingsSchema } from 'domains/settings/schemas';
import { getErrorMessage } from 'utils/error';

import { config } from './config';
import { readPlanUsage } from './domains/agent/storage';
import { readNotifyLevels, writeNotifyLevels } from './domains/inbox/notifications';
import { readInboxState, writeInboxState } from './domains/inbox/storage';
import { readRoutineMemory, writeMemory } from './domains/routine/memory';
import { loadRoutines } from './domains/routine/storage';
import type { Routine } from './domains/routine/types';
import { describeSchedule, getNextRun } from './domains/routine/utils';
import { buildRunTranscript, readRunEvents } from './domains/run/event-log';
import { cancelQueuedRuns, listRoutineQueuedRuns, readQueuedRuns } from './domains/run/queued-runs';
import { deleteExpiredRuns, startCleanup } from './domains/run/retention';
import {
  checkIsRunning,
  checkIsStarting,
  countStartingRuns,
  startDetachedReply,
  startDetachedRuns,
} from './domains/run/runner';
import {
  checkIsProcessAlive,
  getRunningRuns,
  listAllRuns,
  listRuns,
  listRunsSince,
  readRunRecord,
  writeRunRecord,
} from './domains/run/storage';
import { requestWaitAction } from './domains/run/usage-limit';
import { reconcileWorktree, removeWorktree } from './domains/run/worktree';
import { readOneTimeRuns, writeOneTimeRuns } from './domains/scheduler/one-time-runs';
import { getSkips, readSchedulerState } from './domains/scheduler/storage';
import { startQueuedRuns } from './domains/scheduler/tick';
import { readSettings, writeSettings } from './domains/settings/storage';
import {
  deleteExpiredWebhookCalls,
  listWebhookCalls,
  logWebhookCall,
} from './domains/webhook/call-log';
import { WEBHOOK_GATE_TIMEOUT_MS } from './domains/webhook/gate';
import type { WebhookRequest } from './domains/webhook/gate';
import {
  countQueuedWebhooks,
  listQueuedWebhooks,
  WEBHOOK_QUEUE_LIMIT,
} from './domains/webhook/queue';
import { receiveWebhook } from './domains/webhook/receive';
import type { WebhookOutcome } from './domains/webhook/receive';
import { startLiveUpdates } from './features/live-updates/live-updates';
import {
  readCpuLoad,
  readDiskSpace,
  startCpuSampling,
} from './features/machine-usage/machine-usage';
import { getReleaseUpdate, skipRelease } from './features/self-update/releases';
import { parseJson } from './utils/json';

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiRequest = [method: string, segments: string[]];

interface ApiContext {
  url: URL;
  startedAt: Date;
  request: WebhookRequest;
  log: (line: string) => void;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const MAX_CALENDAR_DAYS = 32;
const MAX_BODY_KB = 256;

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } });

function toRoutineSummary(
  routine: Routine,
  runs: RunRecord[],
  oneTimeRuns: OneTimeRun[],
  tokenUsage: TokenUsage | null,
  hasQueuedRuns: boolean,
): RoutineSummary {
  return {
    name: routine.name,
    description: routine.description,
    schedule: routine.schedule,
    scheduleHuman: describeSchedule(routine),
    nextRunAt: getNextRunAt(getNextRun(routine), routine.enabled ? oneTimeRuns : []),
    enabled: routine.enabled,
    webhook: routine.webhook,
    webhookGate: routine.webhookGate,
    check: routine.check,
    queuedWebhooks: countQueuedWebhooks(routine.name),
    agent: routine.agent,
    model: routine.model,
    fallbackModel: routine.fallbackModel,
    effort: routine.effort,
    permissionMode: routine.permissionMode,
    command: routine.command,
    cwd: routine.cwd,
    timeoutMinutes: routine.timeoutMinutes,
    retries: routine.retries,
    runs: routine.runs,
    maxParallel: routine.maxParallel,
    worktree: routine.worktree,
    maxBudgetUsd: routine.maxBudgetUsd,
    file: path.relative(config.projectRoot, routine.file),
    running: checkIsStarting(routine.name) || hasQueuedRuns || runs.some(checkIsRunActive),
    lastRun: runs[0] ?? null,
    lastSkip: getSkips(routine.name).at(-1) ?? null,
    tokenUsage,
    memory: routine.memory,
  };
}

function getStatus(startedAt: Date): DaemonStatus {
  return {
    version: config.version,
    pid: process.pid,
    startedAt: startedAt.toISOString(),
    lastTickAt: readSchedulerState()?.lastTickAt ?? null,
    routinesDir: config.routinesDir,
    stateDir: config.stateDir,
    claudeBin: config.claudeBin,
    codexBin: config.codexBin,
    maxConcurrentRuns: config.maxConcurrentRuns,
    running:
      getRunningRuns().filter(checkIsRunAtWork).length +
      loadRoutines().reduce((sum, routine) => sum + countStartingRuns(routine.name), 0),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toISOString(),
    disk: readDiskSpace(config.stateDir),
    cpuLoad: readCpuLoad(),
    claudeUsage: readPlanUsage('claude'),
  };
}

function withRoutine<T extends ApiResponse | Promise<ApiResponse>>(
  name: RoutineName,
  respond: (routine: Routine) => T,
): T | ApiResponse {
  const routine = loadRoutines().find(candidate => candidate.name === name);
  return routine === undefined ? fail(404, `Unknown routine ${name}`) : respond(routine);
}

function withRun<T extends ApiResponse | Promise<ApiResponse>>(
  routine: RoutineName,
  id: RunId,
  respond: (record: RunRecord) => T,
): T | ApiResponse {
  const record = readRunRecord(routine, id);
  return record === null ? fail(404, 'Run not found') : respond(record);
}

function getRoutineSummaries(): RoutineSummary[] {
  const oneTimeRuns = readOneTimeRuns();
  const queuedRoutines = new Set(readQueuedRuns().map(queued => queued.routine));
  const routines = loadRoutines();
  const runsByRoutine = routines.map(routine => listRuns(routine.name));
  const tokenUsages = buildTokenUsages(runsByRoutine, new Date());
  return routines.map((routine, index) =>
    toRoutineSummary(
      routine,
      runsByRoutine[index] ?? [],
      listRoutineOneTimeRuns(oneTimeRuns, routine.name),
      tokenUsages[index] ?? null,
      queuedRoutines.has(routine.name),
    ),
  );
}

function getRoutineDetail(routine: Routine): ApiResponse {
  const oneTimeRuns = listRoutineOneTimeRuns(readOneTimeRuns(), routine.name);
  const runs = listRuns(routine.name);
  const now = new Date();
  const since = getTokenUsageStart(now);
  // The share needs the tokens of every other routine too.
  const otherRuns = loadRoutines()
    .filter(other => other.name !== routine.name)
    .map(other => listRunsSince(other.name, since));
  const [tokenUsage = null] = buildTokenUsages([runs, ...otherRuns], now);
  const queuedRuns = listRoutineQueuedRuns(routine.name);
  const detail: RoutineDetail = {
    ...toRoutineSummary(routine, runs, oneTimeRuns, tokenUsage, queuedRuns.length > 0),
    prompt: routine.prompt,
    skips: getSkips(routine.name),
    queue: listQueuedWebhooks(routine.name),
    webhookCalls: listWebhookCalls(routine.name),
    oneTimeRuns,
    queuedRuns,
    memoryNotes: routine.memory ? readRoutineMemory(routine.name) : null,
  };
  return ok(detail);
}

function parseOneTimeRun(routine: Routine, body: Buffer): OneTimeRun | null {
  const request = oneTimeRunRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) return null;
  return { routine: routine.name, at: new Date(request.data.at).toISOString() };
}

function scheduleOneTimeRun(routine: Routine, body: Buffer): ApiResponse {
  const oneTimeRun = parseOneTimeRun(routine, body);
  if (oneTimeRun === null) return fail(400, 'The body must be JSON with an ISO time in at');
  if (!routine.enabled) {
    return fail(409, `${routine.name} is disabled, set enabled: true in its frontmatter`);
  }
  const runs = readOneTimeRuns();
  const error = getOneTimeRunError(runs, oneTimeRun, new Date());
  if (error !== null) return fail(400, error);
  writeOneTimeRuns(addOneTimeRun(runs, oneTimeRun));
  return ok({ ok: true });
}

function cancelOneTimeRun(routine: Routine, body: Buffer): ApiResponse {
  const oneTimeRun = parseOneTimeRun(routine, body);
  if (oneTimeRun === null) return fail(400, 'The body must be JSON with an ISO time in at');
  const runs = readOneTimeRuns();
  if (!checkHasOneTimeRun(runs, oneTimeRun)) {
    return fail(
      404,
      `${routine.name} has no run scheduled at that time, it may have started already`,
    );
  }
  writeOneTimeRuns(removeOneTimeRun(runs, oneTimeRun));
  return ok({ ok: true });
}

function saveMemory(routine: Routine, body: Buffer): ApiResponse {
  if (!routine.memory) {
    return fail(
      409,
      `${routine.name} has no memory. It needs agent claude or codex and memory: true`,
    );
  }
  const request = memoryRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) {
    return fail(
      400,
      `The body must be JSON with notes of at most ${MEMORY_MAX_LENGTH} characters in text`,
    );
  }
  writeMemory(routine.name, request.data.text, { by: 'user' });
  return ok({ ok: true });
}

function startRun(routine: Routine, body: Buffer): ApiResponse {
  const request =
    body.length === 0 ? null : startRunRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (request?.success === false) {
    return fail(
      400,
      `The body must be JSON, with a prompt that isn't blank and runs and maxParallel from 1 to ${MAX_RUNS}`,
    );
  }
  const runs = request?.data.runs ?? routine.runs;
  const maxParallel = request?.data.maxParallel ?? Math.min(routine.maxParallel, runs);
  if (maxParallel > runs) return fail(400, `maxParallel must be at most runs, which is ${runs}`);
  if (checkIsRunning(routine.name)) return fail(409, `${routine.name} is already running`);
  const runId = startDetachedRuns(
    routine.name,
    { trigger: 'manual' },
    { count: runs, maxParallel, prompt: request?.data.prompt ?? null },
  );
  startQueuedRuns();
  return { status: 202, body: { ok: true, runId } };
}

function cancelRoutineQueuedRuns(routine: Routine): ApiResponse {
  cancelQueuedRuns(routine.name);
  return ok({ ok: true });
}

function sendMessage(routine: Routine, run: RunRecord, body: Buffer): ApiResponse {
  const message = runMessageSchema.safeParse(parseJson(body.toString('utf8')));
  if (!message.success) return fail(400, 'The message needs text');
  if (!checkCanContinueRun(run)) {
    return fail(409, `This ${run.agent} run has no session to continue`);
  }
  if (checkIsRunning(routine.name)) {
    return fail(409, `${routine.name} is running, send the message once it is done`);
  }
  startDetachedReply(run, { text: message.data.text, source: 'dashboard' });
  return { status: 202, body: { ok: true } };
}

// The reply gets the rules for this session only. The routine's own settings stay as they are.
function allowBlockedActions(routine: Routine, run: RunRecord): ApiResponse {
  const rules = listBlockedRules(run.blockedActions);
  if (rules.length === 0) return fail(409, 'This run has no blocked actions to allow');
  if (!checkCanContinueRun(run)) {
    return fail(409, `This ${run.agent} run has no session to continue`);
  }
  if (checkIsRunning(routine.name)) {
    return fail(409, `${routine.name} is running, try again once it is done`);
  }
  startDetachedReply(run, {
    text: buildAllowMessage(rules),
    source: 'dashboard',
    allowedTools: rules,
  });
  return { status: 202, body: { ok: true } };
}

function sendWaitAction(run: RunRecord, action: string): ApiResponse {
  const parsed = usageLimitWaitActionSchema.safeParse(action);
  if (!parsed.success) return fail(404, 'Not found');
  if (!checkIsRunWaiting(run) || !checkIsProcessAlive(run.pid)) {
    return fail(409, 'This run is not waiting for a usage limit or a retry');
  }
  requestWaitAction(run, parsed.data);
  return { status: 202, body: { ok: true } };
}

async function removeRunWorktree(run: RunRecord): Promise<ApiResponse> {
  const { worktree } = run;
  if (worktree === null) return fail(404, 'This run has no worktree');
  if (checkIsRunActive(run)) {
    return fail(409, 'The run is still working in its worktree. Remove it once the run is done');
  }
  if (!isMatching({ state: 'present' }, worktree)) return ok({ ok: true });
  return match(await removeWorktree(worktree))
    .with({ outcome: 'has_changes' }, () =>
      fail(
        409,
        `The worktree has changes that aren't committed. Commit them, or delete them with git worktree remove --force ${worktree.path}`,
      ),
    )
    .with({ outcome: 'removed' }, removal => {
      // Read again, so a reply that started meanwhile keeps its pid.
      const latest = readRunRecord(run.routine, run.id) ?? run;
      writeRunRecord({ ...latest, worktree: removal.worktree });
      return ok({ ok: true });
    })
    .exhaustive();
}

// Linear treats anything but 200 as a failed delivery.
function toWebhookResponse(
  name: RoutineName,
  outcome: WebhookOutcome,
  context: ApiContext,
): ApiResponse {
  return match(outcome)
    .with({ outcome: 'no_webhook' }, () =>
      fail(404, `${name} has no webhook, add webhook: true to its frontmatter`),
    )
    .with({ outcome: P.union('started', 'continued', 'queued') }, ({ runId }) =>
      ok({ ok: true, runId }),
    )
    .with({ outcome: 'ignored' }, ({ response }) => ok(response ?? { ok: true, runId: null }))
    .with({ outcome: 'rejected' }, ({ reason }) => {
      context.log(`webhookGate of ${name} ${reason}`);
      return fail(401, 'webhookGate rejected the request');
    })
    .with({ outcome: 'timed_out' }, () => {
      context.log(`webhookGate of ${name} timed out`);
      return fail(504, `webhookGate took longer than ${WEBHOOK_GATE_TIMEOUT_MS / 1000} s`);
    })
    .with({ outcome: 'disabled' }, () =>
      fail(409, `${name} is disabled, set enabled: true in its frontmatter`),
    )
    .with({ outcome: 'queue_full' }, () =>
      fail(429, `${name} already has ${WEBHOOK_QUEUE_LIMIT} webhooks waiting`),
    )
    .exhaustive();
}

async function handleWebhook(routine: Routine, context: ApiContext): Promise<ApiResponse> {
  const receivedAt = new Date();
  const outcome = await receiveWebhook(routine, context.request);
  const response = toWebhookResponse(routine.name, outcome, context);
  // The run has started by now, so a sender that saw an error would send it again.
  try {
    logWebhookCall(routine.name, {
      receivedAt,
      outcome,
      status: response.status,
      body: context.request.body,
    });
  } catch (err) {
    context.log(`logging a webhook call of ${routine.name} failed: ${getErrorMessage(err)}`);
  }
  return response;
}

function getCalendar(url: URL): ApiResponse {
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
  return ok(buildCalendar(loadRoutines(), listAllRuns(), readOneTimeRuns(), from, to));
}

function getInsights(url: URL): ApiResponse {
  const days = parseInsightsPeriod(url.searchParams);
  if (days === null) return fail(400, INSIGHTS_PERIOD_ERROR);
  const now = new Date();
  const since = getTokenUsageStart(now, days * 2);
  const runs = loadRoutines().flatMap(routine => listRunsSince(routine.name, since));
  return ok(buildInsights(runs, days, now, readSettings().runRetentionDays));
}

function getRunsPage(url: URL): ApiResponse {
  const query = parseRunsPageQuery(url.searchParams);
  if (query === null) return fail(400, RUNS_CURSOR_ERROR);
  const toPage = (runs: RunRecord[]) =>
    ok(paginateRuns(filterRuns(runs, query.search), query.cursor));
  if (query.routine === null) return toPage(listAllRuns());
  return withRoutine(query.routine, routine => toPage(listRuns(routine.name)));
}

function updateSettings(body: Buffer): ApiResponse {
  const settings = settingsSchema.safeParse(parseJson(body.toString('utf8')));
  if (!settings.success) {
    return fail(400, 'runRetentionDays must be a whole number of days or null');
  }
  writeSettings(settings.data);
  deleteExpiredRuns();
  deleteExpiredWebhookCalls();
  return ok(settings.data);
}

function markRunsRead(body: Buffer): ApiResponse {
  const request = markReadRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) return fail(400, 'The body must list runs with their routine and id');
  const state = readInboxState();
  const next = addReadRuns(state, request.data.runs, listAllRuns());
  if (JSON.stringify(next) !== JSON.stringify(state)) writeInboxState(next);
  return ok({ ok: true });
}

function getInbox(): ApiResponse {
  const routines = loadRoutines().map(routine => routine.name);
  return ok({
    runs: listUnreadRuns(listAllRuns(), readInboxState()),
    notify: keepNotifyLevelsOf(readNotifyLevels(), routines),
  });
}

function setNotifyLevel(routine: Routine, body: Buffer): ApiResponse {
  const request = notifyRequestSchema.safeParse(parseJson(body.toString('utf8')));
  if (!request.success) {
    return fail(400, `level must be one of ${NOTIFY_LEVELS.join(', ')}`);
  }
  writeNotifyLevels(changeNotifyLevel(readNotifyLevels(), routine.name, request.data.level));
  return ok({ ok: true });
}

function routeApi(request: ApiRequest, context: ApiContext): ApiResponse | Promise<ApiResponse> {
  const { url, startedAt } = context;
  return match(request)
    .with(['GET', ['status']], () => ok(getStatus(startedAt)))
    .with(['GET', ['routines']], () => ok(getRoutineSummaries()))
    .with(['GET', ['routines', P.string]], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), getRoutineDetail),
    )
    .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        startRun(routine, context.request.body),
      ),
    )
    .with(['POST', ['routines', P.string, 'queued-runs', 'cancel']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), cancelRoutineQueuedRuns),
    )
    .with(['POST', ['routines', P.string, 'one-time-runs']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        scheduleOneTimeRun(routine, context.request.body),
      ),
    )
    .with(['POST', ['routines', P.string, 'one-time-runs', 'cancel']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        cancelOneTimeRun(routine, context.request.body),
      ),
    )
    .with(['PUT', ['routines', P.string, 'memory']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        saveMemory(routine, context.request.body),
      ),
    )
    .with(['POST', ['routines', P.string, 'webhook']], ([, [, name]]) =>
      withRoutine(routineNameSchema.parse(name), routine => handleWebhook(routine, context)),
    )
    .with(['GET', ['calendar']], () => getCalendar(url))
    .with(['GET', ['inbox']], () => getInbox())
    .with(['GET', ['insights']], () => getInsights(url))
    .with(['POST', ['inbox', 'read']], () => markRunsRead(context.request.body))
    .with(['PUT', ['inbox', 'notify', P.string]], ([, [, , name]]) =>
      withRoutine(routineNameSchema.parse(name), routine =>
        setNotifyLevel(routine, context.request.body),
      ),
    )
    .with(['GET', ['settings']], () => ok(readSettings()))
    .with(['PUT', ['settings']], () => updateSettings(context.request.body))
    .with(['GET', ['releases']], async () => ok(await getReleaseUpdate()))
    .with(['POST', ['releases', P.string, 'skip']], ([, [, version]]) => {
      const parsed = releaseVersionSchema.safeParse(version);
      if (!parsed.success) return fail(400, `${version} is not a release version`);
      skipRelease(parsed.data);
      return ok({ ok: true });
    })
    .with(['GET', ['runs']], () => getRunsPage(url))
    .with(['GET', ['runs', P.string, P.string]], ([, [, routine, id]]) =>
      withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), record =>
        ok(reconcileWorktree(record)),
      ),
    )
    .with(['POST', ['runs', P.string, P.string, 'worktree', 'remove']], ([, [, routine, id]]) =>
      withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), removeRunWorktree),
    )
    .with(['POST', ['runs', P.string, P.string, 'messages']], ([, [, routine, id]]) =>
      withRoutine(routineNameSchema.parse(routine), found =>
        withRun(found.name, runIdSchema.parse(id), run =>
          sendMessage(found, run, context.request.body),
        ),
      ),
    )
    .with(['POST', ['runs', P.string, P.string, 'blocked', 'allow']], ([, [, routine, id]]) =>
      withRoutine(routineNameSchema.parse(routine), found =>
        withRun(found.name, runIdSchema.parse(id), run => allowBlockedActions(found, run)),
      ),
    )
    .with(
      ['POST', ['runs', P.string, P.string, 'wait', P.string]],
      ([, [, routine, id, , action]]) =>
        withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), run =>
          sendWaitAction(run, action),
        ),
    )
    .with(['GET', ['runs', P.string, P.string, 'transcript']], ([, [, routine, id]]) =>
      withRun(routineNameSchema.parse(routine), runIdSchema.parse(id), record =>
        ok(buildRunTranscript(record.agent, readRunEvents(record))),
      ),
    )
    .otherwise(() => fail(404, 'Not found'));
}

function sendJson(res: http.ServerResponse, { status, body }: ApiResponse): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function serveStatic(res: http.ServerResponse, url: URL): void {
  if (!fs.existsSync(config.webAppDist)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('kombinat API is up. Run `pnpm build` to get the dashboard here.\n');
    return;
  }
  const requested = path.normalize(decodeURIComponent(url.pathname));
  const candidate = path.join(config.webAppDist, requested);
  const isFile =
    candidate.startsWith(config.webAppDist) &&
    fs.existsSync(candidate) &&
    fs.statSync(candidate).isFile();
  const file = isFile ? candidate : path.join(config.webAppDist, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// There is no login, so pages from other sites must not start runs through the browser.
export function checkIsCrossSite(headers: http.IncomingHttpHeaders): boolean {
  const site = headers['sec-fetch-site'];
  if (site !== undefined) return site !== 'same-origin' && site !== 'none';
  return headers.origin !== undefined && URL.parse(headers.origin)?.host !== headers.host;
}

// Read to the end anyway, so the client gets the 413.
function readBody(req: http.IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY_KB * 1024) chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(size > MAX_BODY_KB * 1024 ? null : Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function handleApi(
  req: http.IncomingMessage,
  segments: string[],
  context: Omit<ApiContext, 'request'>,
): Promise<ApiResponse> {
  const method = req.method ?? 'GET';
  const { headers } = req;
  if (method === 'GET') {
    return routeApi([method, segments], {
      ...context,
      request: { body: Buffer.alloc(0), headers },
    });
  }
  if (checkIsCrossSite(headers)) {
    return fail(403, 'Requests from other sites cannot change anything');
  }
  const body = await readBody(req);
  if (body === null) return fail(413, `The request body is larger than ${MAX_BODY_KB} KB`);
  return routeApi([method, segments], { ...context, request: { body, headers } });
}

export function startServer(log: (line: string) => void): http.Server {
  const startedAt = new Date();
  const liveUpdates = startLiveUpdates();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${config.port}`);
    const [root, ...segments] = url.pathname.split('/').filter(Boolean);
    const respond = async (): Promise<void> => {
      if (root !== 'api') serveStatic(res, url);
      else if (req.method === 'GET' && url.pathname === '/api/events') liveUpdates.follow(req, res);
      else sendJson(res, await handleApi(req, segments, { url, startedAt, log }));
    };
    respond().catch((error: unknown) => {
      const message = getErrorMessage(error);
      log(`request failed ${url.pathname}: ${message}`);
      sendJson(res, fail(500, message));
    });
  });
  server.on('close', startCpuSampling());
  server.on(
    'close',
    startCleanup(log, [
      { items: 'runs', deleteExpired: deleteExpiredRuns },
      { items: 'webhook calls', deleteExpired: deleteExpiredWebhookCalls },
    ]),
  );
  server.on('close', liveUpdates.stop);
  server.listen(config.port, '127.0.0.1', () => {
    log(`ui at http://localhost:${config.port}`);
  });
  return server;
}
