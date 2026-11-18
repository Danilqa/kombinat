import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

import { config } from '../../config';

const NOTIFY_DELAY_MS = 300;
const STATE_ENTRIES = ['runs', 'queue', 'scheduler.json'];

export interface LiveUpdates {
  follow: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  stop: () => void;
}

// Run logs grow with every agent event, so a run counts as changed only when its record does.
export function checkIsWatchedStateFile(file: string): boolean {
  const [entry = ''] = file.split(path.sep);
  return STATE_ENTRIES.includes(entry) && !file.endsWith('.jsonl') && !file.endsWith('.tmp');
}

function checkIsRoutineFile(file: string): boolean {
  return file.endsWith('.md');
}

function watchFolder(
  dir: string,
  isRecursive: boolean,
  checkIsWatched: (file: string) => boolean,
  onChange: () => void,
): fs.FSWatcher | null {
  if (!fs.existsSync(dir)) return null;
  const watcher = fs.watch(dir, { recursive: isRecursive }, (_event, file) => {
    if (file === null || checkIsWatched(file)) onChange();
  });
  watcher.on('error', () => watcher.close());
  watcher.unref();
  return watcher;
}

export function startLiveUpdates(): LiveUpdates {
  const followers = new Set<http.ServerResponse>();
  let timer: NodeJS.Timeout | null = null;
  const notify = () => {
    timer ??= setTimeout(() => {
      timer = null;
      for (const res of followers) res.write('data: change\n\n');
    }, NOTIFY_DELAY_MS);
  };
  const watchers = [
    watchFolder(config.routinesDir, false, checkIsRoutineFile, notify),
    watchFolder(config.stateDir, true, checkIsWatchedStateFile, notify),
  ];

  return {
    follow(req, res) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
      res.flushHeaders();
      followers.add(res);
      req.on('close', () => followers.delete(res));
    },
    stop() {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers) watcher?.close();
    },
  };
}
