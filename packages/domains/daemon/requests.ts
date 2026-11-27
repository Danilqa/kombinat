import type { Api } from 'utils/api';

import { CHANGES_RECONNECT_MS } from './constants';
import { daemonStatusSchema } from './schemas';
import type { DaemonStatus } from './types';

export async function getDaemonStatus(api: Api): Promise<DaemonStatus> {
  return api.get('/api/status').json(daemonStatusSchema);
}

function waitToReconnect(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, CHANGES_RECONNECT_MS);
    signal.addEventListener('abort', done);
  });
}

async function readChanges(
  changes: ReadableStream<Uint8Array>,
  onChange: () => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = changes.getReader();
  // In Node the signal no longer reaches an open stream once ky's request is garbage-collected.
  const stop = () => void reader.cancel().catch(() => undefined);
  if (signal.aborted) stop();
  signal.addEventListener('abort', stop);
  try {
    const decoder = new TextDecoder();
    let pending = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      const events = (pending + decoder.decode(value, { stream: true })).split('\n\n');
      pending = events.pop() ?? '';
      if (events.length > 0) onChange();
    }
  } finally {
    signal.removeEventListener('abort', stop);
  }
}

// Until the signal aborts. After a reconnect it calls onChange once for what changed meanwhile.
export async function watchDaemonChanges(
  api: Api,
  onChange: () => void,
  signal: AbortSignal,
): Promise<void> {
  let hasConnected = false;
  while (!signal.aborted) {
    try {
      // The stream has no end, so no timeout. A daemon without the change feed answers with an error.
      const response = await api.get('/api/events', {
        signal,
        totalTimeout: false,
        throwHttpErrors: false,
      });
      const changes = response.ok ? response.body : null;
      if (changes === null) return;
      if (hasConnected) onChange();
      hasConnected = true;
      await readChanges(changes, onChange, signal);
    } catch {
      // The daemon restarted or went away, and polling covers the gap until it is back.
    }
    await waitToReconnect(signal);
  }
}
