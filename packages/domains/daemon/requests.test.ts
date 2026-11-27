import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

import { createApi } from 'utils/api';

import { CHANGES_RECONNECT_MS } from './constants';
import { watchDaemonChanges } from './requests';

const API_TIMEOUT_MS = 30_000;

const encoder = new TextEncoder();

function makeStream(chunks: string[]): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

type Answer = Response | Error | Promise<Response>;

function makeApi(t: TestContext, answers: Answer[]) {
  const requests: Request[] = [];
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    requests.push(request);
    const [answer = new Error('daemon not reachable')] = answers.splice(0, 1);
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const api = createApi({ baseUrl: 'http://daemon.test', timeoutMs: API_TIMEOUT_MS });
  return { api, requests, getOpened: () => requests.length };
}

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

test('an event split across chunks counts once it is complete', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, requests } = makeApi(t, [
    makeStream(['data: ch', 'ange\n\n', 'data: change\n\ndata: change\n\n']),
  ]);
  const controller = new AbortController();
  let changes = 0;
  const watching = watchDaemonChanges(api, () => (changes += 1), controller.signal);
  await flush();
  assert.equal(changes, 2);
  assert.deepEqual(
    requests.map(request => `${request.method} ${request.url}`),
    ['GET http://daemon.test/api/events'],
  );
  controller.abort();
  await watching;
});

test('after the daemon comes back, one change covers what it missed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, getOpened } = makeApi(t, [
    makeStream([]),
    new TypeError('fetch failed'),
    makeStream(['data: change\n\n']),
  ]);
  const controller = new AbortController();
  let changes = 0;
  const watching = watchDaemonChanges(api, () => (changes += 1), controller.signal);
  await flush();
  assert.equal(getOpened(), 1);
  t.mock.timers.tick(CHANGES_RECONNECT_MS);
  await flush();
  assert.equal(getOpened(), 2);
  assert.equal(changes, 0);
  t.mock.timers.tick(CHANGES_RECONNECT_MS);
  await flush();
  assert.equal(getOpened(), 3);
  assert.equal(changes, 2);
  controller.abort();
  await watching;
});

test('an open stream closes when the signal aborts, even if fetch has lost the signal', async t => {
  let isCancelled = false;
  const openStream = new ReadableStream<Uint8Array>({
    start: controller => controller.enqueue(encoder.encode('data: change\n\n')),
    cancel: () => {
      isCancelled = true;
    },
  });
  const { api, getOpened } = makeApi(t, [new Response(openStream)]);
  const controller = new AbortController();
  let changes = 0;
  const watching = watchDaemonChanges(api, () => (changes += 1), controller.signal);
  await flush();
  assert.equal(changes, 1);
  controller.abort();
  await watching;
  assert.equal(isCancelled, true);
  assert.equal(getOpened(), 1);
});

test('a daemon without the change feed is not asked again', async t => {
  const { api, getOpened } = makeApi(t, [Response.json({ error: 'Not found' }, { status: 404 })]);
  await watchDaemonChanges(
    api,
    () => assert.fail('no change expected'),
    new AbortController().signal,
  );
  assert.equal(getOpened(), 1);
});

test("the stream outlives the timeout of the api's other requests", async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let answer: (response: Response) => void = () => undefined;
  const slowAnswer = new Promise<Response>(resolve => (answer = resolve));
  const { api, getOpened } = makeApi(t, [slowAnswer]);
  const controller = new AbortController();
  let changes = 0;
  const watching = watchDaemonChanges(api, () => (changes += 1), controller.signal);
  await flush();
  t.mock.timers.tick(2 * API_TIMEOUT_MS);
  await flush();
  answer(makeStream(['data: change\n\n']));
  await flush();
  assert.equal(changes, 1);
  assert.equal(getOpened(), 1);
  controller.abort();
  await watching;
});
