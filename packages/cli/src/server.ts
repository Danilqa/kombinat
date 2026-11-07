import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { isMatching, match, P } from 'ts-pattern';

import type { DaemonStatus } from 'domains/daemon/types';
import type { RoutineDetail, RoutineSummary } from 'domains/routine/types';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import type { RunRecord } from 'domains/run/types';
import type { Skip } from 'domains/scheduler/types';
import { getErrorMessage } from 'utils/error';

import { config } from './config';
import { buildTranscript } from './domains/agent/registry';
import { buildCalendar } from './domains/calendar/utils';
import { loadRoutines } from './domains/routine/utils';
import type { Routine } from './domains/routine/utils';
import { startDetachedRun } from './domains/run/runner';
import { listAllRuns, listRuns, readRunRecord, readSchedulerState } from './domains/run/storage';
import { getNextRun } from './domains/scheduler/tick';
import { describeCron } from './utils/cron';
import { parseJson } from './utils/json';

interface ApiResponse {
  status: number;
  body: unknown;
}

type ApiRequest = [method: string, segments: string[]];

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

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const fail = (status: number, error: string): ApiResponse => ({ status, body: { error } });

function getSkips(routine: string): Skip[] {
  return readSchedulerState()?.routines[routine]?.skips ?? [];
}

function toRoutineSummary(routine: Routine, runs: RunRecord[]): RoutineSummary {
  return {
    name: routine.name,
    description: routine.description,
    schedule: routine.schedule,
    scheduleHuman: routine.schedule === null ? 'Manual' : describeCron(routine.schedule),
    nextRunAt: getNextRun(routine),
    enabled: routine.enabled,
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

function readEvents(record: RunRecord): unknown[] {
  if (!fs.existsSync(record.logFile)) return [];
  return fs
    .readFileSync(record.logFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(parseJson)
    .filter(event => event !== undefined);
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

function withRoutine(name: string, respond: (routine: Routine) => ApiResponse): ApiResponse {
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
  };
  return ok(detail);
}

function startRun(routine: Routine): ApiResponse {
  if (listRuns(routine.name).some(isMatching({ status: 'running' }))) {
    return fail(409, `${routine.name} is already running`);
  }
  startDetachedRun(routine.name, { trigger: 'manual' });
  return { status: 202, body: { ok: true } };
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

function routeApi(request: ApiRequest, url: URL, startedAt: Date): ApiResponse {
  return match(request)
    .with(['GET', ['status']], () => ok(getStatus(startedAt)))
    .with(['GET', ['routines']], () =>
      ok(loadRoutines().map(routine => toRoutineSummary(routine, listRuns(routine.name)))),
    )
    .with(['GET', ['routines', P.string]], ([, [, name]]) => withRoutine(name, getRoutineDetail))
    .with(['POST', ['routines', P.string, 'run']], ([, [, name]]) => withRoutine(name, startRun))
    .with(['GET', ['calendar']], () => getCalendar(url))
    .with(['GET', ['runs']], () =>
      ok(listAllRuns().slice(0, Number(url.searchParams.get('limit') ?? RECENT_RUNS_LIMIT))),
    )
    .with(['GET', ['runs', P.string, P.string]], ([, [, routine, id]]) => withRun(routine, id, ok))
    .with(['GET', ['runs', P.string, P.string, 'transcript']], ([, [, routine, id]]) =>
      withRun(routine, id, record => ok(buildTranscript(record.agent, readEvents(record)))),
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
export function isCrossSite(headers: http.IncomingHttpHeaders): boolean {
  const site = headers['sec-fetch-site'];
  if (site !== undefined) return site !== 'same-origin' && site !== 'none';
  return headers.origin !== undefined && URL.parse(headers.origin)?.host !== headers.host;
}

export function startServer(log: (line: string) => void): http.Server {
  const startedAt = new Date();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${config.port}`);
    const [root, ...segments] = url.pathname.split('/').filter(Boolean);
    try {
      if (root !== 'api') serveStatic(res, url);
      else if (req.method !== 'GET' && isCrossSite(req.headers)) {
        sendJson(res, fail(403, 'Requests from other sites cannot change anything'));
      } else sendJson(res, routeApi([req.method ?? 'GET', segments], url, startedAt));
    } catch (error) {
      const message = getErrorMessage(error);
      log(`request failed ${url.pathname}: ${message}`);
      sendJson(res, fail(500, message));
    }
  });
  server.listen(config.port, '127.0.0.1', () => {
    log(`ui at http://localhost:${config.port}`);
  });
  return server;
}
