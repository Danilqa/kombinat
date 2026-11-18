import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { HttpClient } from 'utils/http';

import { CHANGES_RECONNECT_MS } from './constants';
import { watchDaemonChanges } from './requests';

const encoder = new TextEncoder();

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function makeHttp(answers: (ReadableStream<Uint8Array> | null | Error)[]) {
  let opened = 0;
  const http: HttpClient = {
    request: () => Promise.reject(new Error('not used')),
    openStream: () => {
      opened += 1;
      const [answer = new Error('daemon not reachable')] = answers.splice(0, 1);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
  return { http, getOpened: () => opened };
}

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

test('an event split across chunks counts once it is complete', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { http } = makeHttp([
    makeStream(['data: ch', 'ange\n\n', 'data: change\n\ndata: change\n\n']),
  ]);
  const controller = new AbortController();
  let changes = 0;
  const watching = watchDaemonChanges(http, () => (changes += 1), controller.signal);
  await flush();
  assert.equal(changes, 2);
  controller.abort();
  await watching;
});

test('after the daemon comes back, one change covers what it missed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { http, getOpened } = makeHttp([
    makeStream([]),
    new Error('daemon not reachable'),
    makeStream(['data: change\n\n']),
  ]);
  const controller = new AbortController();
  let changes = 0;
  const watching = watchDaemonChanges(http, () => (changes += 1), controller.signal);
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

test('a daemon without the change feed is not asked again', async () => {
  const { http, getOpened } = makeHttp([null]);
  await watchDaemonChanges(
    http,
    () => assert.fail('no change expected'),
    new AbortController().signal,
  );
  assert.equal(getOpened(), 1);
});
