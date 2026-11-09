import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { isMatching, match, P } from 'ts-pattern';

import { buildCalendar } from 'domains/calendar/utils';
import type { DaemonStatus } from 'domains/daemon/types';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import type { RunRecord } from 'domains/run/types';
import { createRunId } from 'domains/run/utils';
import { getErrorMessage } from 'utils/error';

import { config } from './config';
import { loadRoutines } from './domains/routine/storage';
import type { Routine } from './domains/routine/types';
import { describeSchedule, getNextRun } from './domains/routine/utils';
import { buildRunTranscript, readRunEvents } from './domains/run/event-log';
import { writePayload } from './domains/run/payload';
import {
  countQueuedWebhooks,
  enqueueWebhook,
  listQueuedWebhooks,
  WEBHOOK_QUEUE_LIMIT,
} from './domains/run/queue';
import { checkIsStarting, startDetachedRun } from './domains/run/runner';
import { decideWebhook, WEBHOOK_GATE_TIMEOUT_MS } from './domains/run/webhook-gate';
import type { WebhookRequest } from './domains/run/webhook-gate';
import { listAllRuns, listRuns, readRunRecord } from './domains/run/storage';
import { getSkips, readSchedulerState } from './domains/scheduler/storage';

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
  '.woff2': 'font/woff2',
};

const MAX_CALENDAR_DAYS = 32;
const MAX_BODY_KB = 256;

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } });

function toRoutineSummary(routine: Routine, runs: RunRecord[]): RoutineSummary {
  return {
    name: routine.name,
    description: routine.description,
    schedule: routine.schedule,
    scheduleHuman: describeSchedule(routine),
    nextRunAt: getNextRun(routine),
    enabled: routine.enabled,
    webhook: routine.webhook,
    webhookGate: routine.webhookGate,
    queuedWebhooks: countQueuedWebhooks(routine.name),
    agent: routine.agent,
    model: routine.model,
    effort: routine.effort,
    permissionMode: routine.permissionMode,
    command: routine.command,
    cwd: routine.cwd,
    timeoutMinutes: routine.timeoutMinutes,
    maxBudgetUsd: routine.maxBudgetUsd,
    file: path.relative(config.projectRoot, routine.file),
    running: runs.some(isMatching({ status: 'running' })),
    lastRun: runs[0] ?? null,
    lastSkip: getSkips(routine.name).at(-1) ?? null,
  };
}

function getStatus(startedAt: Date): DaemonStatus {
  return {
    pid: process.pid,
    startedAt: startedAt.toISOString(),
    lastTickAt: readSchedulerState()?.lastTickAt ?? null,
    routinesDir: config.routinesDir,
    stateDir: config.stateDir,
    claudeBin: config.claudeBin,
    codexBin: config.codexBin,
    maxConcurrentRuns: config.maxConcurrentRuns,
    running: listAllRuns().filter(isMatching({ status: 'running' })).length,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toISOString(),
  };
}

function withRoutine<T extends ApiResponse | Promise<ApiResponse>>(
  name: string,
  respond: (routine: Routine) => T,
): T | ApiResponse {
  const routine = loadRoutines().find(candidate => candidate.name === name);
  return routine === undefined ? fail(404, `Unknown routine ${name}`) : respond(routine);
}

function withRun(
  routine: string,
  id: string,
  respond: (record: RunRecord) => ApiResponse,
): ApiResponse {
  const record = readRunRecord(routine, id);
  return record === null ? fail(404, 'Run not found') : respond(record);
}

function getRoutineDetail(routine: Routine): ApiResponse {
  const runs = listRuns(routine.name);
  const detail: RoutineDetail = {
    ...toRoutineSummary(routine, runs),
    prompt: routine.prompt,
    runs,
    skips: getSkips(routine.name),
    queue: listQueuedWebhooks(routine.name),
  };
  return ok(detail);
}

function checkIsRunning(routine: Routine): boolean {
  return (
    checkIsStarting(routine.name) || listRuns(routine.name).some(isMatching({ status: 'running' }))
  );
}

function startRun(routine: Routine): ApiResponse {
  if (checkIsRunning(routine)) return fail(409, `${routine.name} is already running`);
  startDetachedRun(routine.name, { trigger: 'manual' });
  return { status: 202, body: { ok: true } };
}

function startWebhookRun(routine: Routine, payload: string): ApiResponse {
  if (!routine.enabled) return fail(409, `${routine.name} is disabled`);
  const runId = createRunId();
  if (checkIsRunning(routine) || countQueuedWebhooks(routine.name) > 0) {
    if (enqueueWebhook(routine.name, runId, payload)) return ok({ ok: true, runId });
    return fail(429, `${routine.name} already has ${WEBHOOK_QUEUE_LIMIT} webhooks waiting`);
  }
  if (payload !== '') writePayload(routine.name, runId, payload);
  startDetachedRun(routine.name, { trigger: 'webhook', runId });
  return ok({ ok: true, runId });
}

// Linear treats anything but 200 as a failed delivery.
async function handleWebhook(routine: Routine, context: ApiContext): Promise<ApiResponse> {
  if (!routine.webhook) {
    return fail(404, `${routine.name} has no webhook, add webhook: true to its frontmatter`);
  }
  const decision = await decideWebhook(routine, context.request);
  return match(decision)
    .with({ outcome: 'run' }, ({ payload }) => startWebhookRun(routine, payload))
    .with({ outcome: 'ignore' }, ({ response }) => ok(response ?? { ok: true, runId: null }))
    .with({ outcome: 'reject' }, ({ reason }) => {
      context.log(`webhookGate of ${routine.name} ${reason}`);
      return fail(401, 'webhookGate rejected the request');
    })
    .with({ outcome: 'timeout' }, () => {
      context.log(`webhookGate of ${routine.name} timed out`);
      return fail(504, `webhookGate took longer than ${WEBHOOK_GATE_TIMEOUT_MS / 1000} s`);
    })
    .exhaustive();
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
  return ok(buildCalendar(loadRoutines(), listAllRuns(), from, to));
}

function routeApi(request: ApiRequest, context: ApiContext): ApiResponse | Promise<ApiResponse> {
  const { url, startedAt } = context;
  return match(request)
    .with(['GET', ['status']], () => ok(getStatus(startedAt)))
    .with(['GET', ['routines']], () =>
      ok(loadRoutines().map(routine => toRoutineSummary(routine, listRuns(routine.name)))),
    )
    .with(['GET', ['routines', P.string]], ([, [, name]]) => withRoutine(name, getRoutineDetail))
    .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) => withRoutine(name, startRun))
    .with(['POST', ['routines', P.string, 'webhook']], ([, [, name]]) =>
      withRoutine(name, routine => handleWebhook(routine, context)),
    )
    .with(['GET', ['calendar']], () => getCalendar(url))
    .with(['GET', ['runs']], () =>
      ok(listAllRuns().slice(0, Number(url.searchParams.get('limit') ?? RECENT_RUNS_LIMIT))),
    )
    .with(['GET', ['runs', P.string, P.string]], ([, [, routine, id]]) => withRun(routine, id, ok))
    .with(['GET', ['runs', P.string, P.string, 'transcript']], ([, [, routine, id]]) =>
      withRun(routine, id, record => ok(buildRunTranscript(record.agent, readRunEvents(record)))),
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
    res.end('kombinat API is up. Build the UI with `pnpm build` to get the dashboard here.\n');
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
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${config.port}`);
    const [root, ...segments] = url.pathname.split('/').filter(Boolean);
    const respond = async (): Promise<void> => {
      if (root !== 'api') serveStatic(res, url);
      else sendJson(res, await handleApi(req, segments, { url, startedAt, log }));
    };
    respond().catch((error: unknown) => {
      const message = getErrorMessage(error);
      log(`request failed ${url.pathname}: ${message}`);
      sendJson(res, fail(500, message));
    });
  });
  server.listen(config.port, '127.0.0.1', () => {
    log(`ui at http://localhost:${config.port}`);
  });
  return server;
}
