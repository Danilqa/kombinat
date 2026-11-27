import assert from 'node:assert/strict';
import { createServer, type RequestListener, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';

import { isHTTPError } from 'ky';
import { z } from 'zod';

import { createApi } from './api';

const NETWORK_ERROR_MESSAGE = 'daemon not reachable';

const okSchema = z.object({ ok: z.literal(true) });

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

async function getClosedUrl(): Promise<string> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = getPort(server);
  await new Promise(resolve => server.close(resolve));
  return `http://127.0.0.1:${port}`;
}

function fakeFetch(t: TestContext, respond: (request: Request) => Promise<Response> | Response) {
  const requests: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    requests.push(request.clone());
    return respond(request);
  });
  return requests;
}

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

test('a path in the base URL stays in front of the request path', async t => {
  const paths: (string | undefined)[] = [];
  const baseUrl = await listen(t, (request, response) => {
    paths.push(request.url);
    response.setHeader('content-type', 'application/json').end('{"ok":true}');
  });
  const api = createApi({ baseUrl: `${baseUrl}/behind/a-proxy` });

  assert.deepEqual(await api.get('/api/status').json(okSchema), { ok: true });
  assert.deepEqual(paths, ['/behind/a-proxy/api/status']);
});

test("a failed request rejects with the daemon's own error text", async t => {
  const baseUrl = await listen(t, (_request, response) => {
    response
      .writeHead(409, { 'content-type': 'application/json; charset=utf-8' })
      .end(JSON.stringify({ error: 'daily-digest is already running' }));
  });
  const api = createApi({ baseUrl, networkErrorMessage: NETWORK_ERROR_MESSAGE });

  await assert.rejects(
    api.post('/api/routines/daily-digest/run').json(okSchema),
    (error: Error) => {
      assert.equal(error.message, 'daily-digest is already running');
      assert.ok(isHTTPError(error));
      assert.equal(error.response.status, 409);
      return true;
    },
  );
});

test('a failed request without an error text rejects with the status', async t => {
  const baseUrl = await listen(t, (_request, response) => {
    response.writeHead(404, { 'content-type': 'text/plain' }).end('no such page');
  });
  const api = createApi({ baseUrl, networkErrorMessage: NETWORK_ERROR_MESSAGE });

  await assert.rejects(api.get('/api/settings').json(okSchema), { message: '404 Not Found' });
});

test('a failed request is sent once', async t => {
  const requests = fakeFetch(t, () => Response.json({ error: 'out of order' }, { status: 503 }));
  const api = createApi({ baseUrl: 'http://daemon.test' });

  await assert.rejects(api.get('/api/status').json(okSchema), { message: 'out of order' });
  assert.equal(requests.length, 1);
});

test('a refused connection rejects with the network error message, after one try', async t => {
  const api = createApi({
    baseUrl: await getClosedUrl(),
    networkErrorMessage: NETWORK_ERROR_MESSAGE,
  });
  const fetchFromNetwork = globalThis.fetch;
  const fetchOnce = t.mock.method(globalThis, 'fetch', fetchFromNetwork);

  await assert.rejects(api.get('/api/status').json(okSchema), { message: NETWORK_ERROR_MESSAGE });
  assert.equal(fetchOnce.mock.callCount(), 1);
});

test('without a network error message the underlying error surfaces', async () => {
  const api = createApi({ baseUrl: await getClosedUrl() });

  await assert.rejects(api.get('/api/status').json(okSchema), (error: Error) => {
    assert.equal(error.name, 'NetworkError');
    assert.ok(error.cause instanceof TypeError);
    return true;
  });
});

test('an answer later than the timeout rejects with the network error message', async t => {
  const baseUrl = await listen(t);
  const api = createApi({ baseUrl, timeoutMs: 50, networkErrorMessage: NETWORK_ERROR_MESSAGE });

  await assert.rejects(api.get('/api/status').json(okSchema), { message: NETWORK_ERROR_MESSAGE });
});

test('the timeout covers a body that never ends', async t => {
  const baseUrl = await listen(t, (_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' }).write('{"ok":');
  });
  const api = createApi({ baseUrl, timeoutMs: 50, networkErrorMessage: NETWORK_ERROR_MESSAGE });

  await assert.rejects(api.get('/api/status').json(okSchema), { message: NETWORK_ERROR_MESSAGE });
});

test('without a timeout a request waits for a slow answer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let answer: (response: Response) => void = () => undefined;
  const slowAnswer = new Promise<Response>(resolve => (answer = resolve));
  fakeFetch(t, () => slowAnswer);
  const api = createApi({ baseUrl: 'http://daemon.test' });
  let outcome = 'waiting';

  const request = api
    .get('/api/releases')
    .json(okSchema)
    .then(
      () => (outcome = 'answered'),
      () => (outcome = 'failed'),
    );
  await flush();
  t.mock.timers.tick(60_000);
  await flush();
  assert.equal(outcome, 'waiting');

  answer(Response.json({ ok: true }));
  await request;
  assert.equal(outcome, 'answered');
});

test('an answer that does not match its schema rejects', async t => {
  fakeFetch(t, () => Response.json({ ok: 'yes' }));
  const api = createApi({ baseUrl: 'http://daemon.test', networkErrorMessage: 'not this one' });

  await assert.rejects(api.get('/api/status').json(okSchema), { name: 'SchemaValidationError' });
});

test('an api made before fetch is replaced still calls the replacement', async t => {
  const api = createApi({ baseUrl: 'http://daemon.test' });
  const requests = fakeFetch(t, () => Response.json({ ok: true }));

  await api
    .put('/api/settings', { json: { runRetentionDays: 30 }, searchParams: { a: 1, b: undefined } })
    .json(okSchema);

  const [request] = requests;
  assert.ok(request !== undefined);
  assert.equal(request.method, 'PUT');
  assert.equal(request.url, 'http://daemon.test/api/settings?a=1');
  assert.equal(request.headers.get('content-type'), 'application/json');
  assert.equal(await request.text(), '{"runRetentionDays":30}');
});
