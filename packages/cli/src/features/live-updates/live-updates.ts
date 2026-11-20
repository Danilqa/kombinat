import fs from 'node:fs';
import type http from 'node:http';
import path from 'node:path';

import { config } from '../../config';
import { NOTIFICATIONS_FILE } from '../../domains/inbox/notifications';
import { ONE_TIME_RUNS_FILE } from '../../domains/scheduler/one-time-runs';
import { readSchedulerState } from '../../domains/scheduler/storage';

const NOTIFY_DELAY_MS = 300;
const SCHEDULER_FILE = 'scheduler.json';
const STATE_ENTRIES = [
  'runs',
  'queue',
  'webhooks',
  'inbox.json',
  NOTIFICATIONS_FILE,
  ONE_TIME_RUNS_FILE,
  SCHEDULER_FILE,
];

export interface LiveUpdates {
  follow: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  stop: () => void;
}

// Run logs grow with every agent event, so a run counts as changed only when its record does.
export function checkIsWatchedStateFile(file: string): boolean {
  const [entry = ''] = file.split(path.sep);
  return STATE_ENTRIES.includes(entry) && !file.endsWith('.jsonl') && !file.endsWith('.tmp');
}

// The tick rewrites the file every 30 s for its own time, which clients poll with the status.
function readSchedule(): string {
  return JSON.stringify({ ...readSchedulerState(), lastTickAt: null });
}

export function trackSchedule(): () => boolean {
  let schedule = readSchedule();
  return function checkHasScheduleChanged() {
    const next = readSchedule();
    const hasChanged = next !== schedule;
    schedule = next;
    return hasChanged;
  };
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
  const checkHasScheduleChanged = trackSchedule();
  const checkIsStateChange = (file: string) =>
    checkIsWatchedStateFile(file) && (file !== SCHEDULER_FILE || checkHasScheduleChanged());
  const watchers = [
    watchFolder(config.routinesDir, false, checkIsRoutineFile, notify),
    watchFolder(config.stateDir, true, checkIsStateChange, notify),
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
