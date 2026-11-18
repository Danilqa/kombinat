import type { HttpClient } from 'utils/http';

import { CHANGES_RECONNECT_MS } from './constants';
import { daemonStatusSchema } from './schemas';
import type { DaemonStatus } from './types';

export async function getDaemonStatus(http: HttpClient): Promise<DaemonStatus> {
  return http.request('/api/status', daemonStatusSchema);
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
): Promise<void> {
  const reader = changes.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    const events = (pending + decoder.decode(value, { stream: true })).split('\n\n');
    pending = events.pop() ?? '';
    if (events.length > 0) onChange();
  }
}

// Until the signal aborts. After a reconnect it calls onChange once for what changed meanwhile.
export async function watchDaemonChanges(
  http: HttpClient,
  onChange: () => void,
  signal: AbortSignal,
): Promise<void> {
  let hasConnected = false;
  while (!signal.aborted) {
    try {
      const changes = await http.openStream('/api/events', { signal });
      if (changes === null) return;
      if (hasConnected) onChange();
      hasConnected = true;
      await readChanges(changes, onChange);
    } catch {
      // The daemon restarted or went away, and polling covers the gap until it is back.
    }
    await waitToReconnect(signal);
  }
}
