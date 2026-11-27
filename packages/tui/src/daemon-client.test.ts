import assert from 'node:assert/strict';
import { createServer, type RequestListener, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';

import type { DaemonStatus } from 'domains/daemon/types';
import { routineNameSchema } from 'domains/routine/ids';
import { DEFAULT_SETTINGS } from 'domains/settings/constants';

import { createDaemonClient } from './daemon-client';

const DAILY_DIGEST = routineNameSchema.parse('daily-digest');

const STATUS: DaemonStatus = {
  pid: 4242,
  startedAt: '2026-06-01T08:00:00.000Z',
  lastTickAt: null,
  routinesDir: '/repo/routines',
  stateDir: '/repo/state',
  claudeBin: 'claude',
  codexBin: 'codex',
  maxConcurrentRuns: 3,
  running: 0,
  timezone: 'UTC',
  now: '2026-06-01T09:00:00.000Z',
  accounts: [],
};

const OLDER_DAEMON_ANSWERS: Record<string, unknown> = {
  'GET /api/status': STATUS,
  'GET /api/routines': [],
  'GET /api/runs': { runs: [], nextCursor: null, total: 0 },
};

function getPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('The server has no port');
  return address.port;
}

async function listen(t: TestContext, respond?: RequestListener): Promise<string> {
  const server = createServer(respond);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${getPort(server)}`;
}

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

test('a daemon without the settings and releases endpoints still gives an overview', async t => {
  const baseUrl = await listen(t, (request, response) => {
    const answer = OLDER_DAEMON_ANSWERS[`${request.method} ${request.url}`];
    response
      .writeHead(answer === undefined ? 404 : 200, { 'content-type': 'application/json' })
      .end(JSON.stringify(answer ?? { error: 'Not found' }));
  });

  const overview = await createDaemonClient(baseUrl).getOverview();

  assert.deepEqual(overview, {
    status: STATUS,
    routines: [],
    runs: [],
    settings: DEFAULT_SETTINGS,
    releaseUpdate: null,
  });
});

test("a request the daemon turns down rejects with the daemon's own error text", async t => {
  const baseUrl = await listen(t, (_request, response) => {
    response
      .writeHead(409, { 'content-type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ error: 'daily-digest is already running' }));
  });

  await assert.rejects(createDaemonClient(baseUrl).startRun(DAILY_DIGEST), {
    message: 'daily-digest is already running',
  });
});

test('a daemon that is not listening is reported as not reachable at its URL', async () => {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${getPort(server)}`;
  await new Promise(resolve => server.close(resolve));

  await assert.rejects(createDaemonClient(baseUrl).getRoutine(DAILY_DIGEST), {
    message: `daemon not reachable at ${baseUrl}`,
  });
});

test('a daemon that does not answer in 30 seconds is reported as not reachable', async t => {
  const baseUrl = await listen(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let failure = 'none yet';

  const routine = createDaemonClient(baseUrl)
    .getRoutine(DAILY_DIGEST)
    .catch((error: unknown) => (failure = String(error)));
  await flush();
  t.mock.timers.tick(29_999);
  await flush();
  assert.equal(failure, 'none yet');

  t.mock.timers.tick(1);
  await routine;
  assert.equal(failure, `Error: daemon not reachable at ${baseUrl}`);
});
