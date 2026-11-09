import fs from 'node:fs';
import path from 'node:path';

import { config } from '../../config';

export const WEBHOOK_QUEUE_LIMIT = 100;

let lastQueuedAt = 0;

export interface QueuedWebhook {
  runId: string;
  payload: string;
}

function getQueueDir(routine: string): string {
  return path.join(config.stateDir, 'queue', routine);
}

// Names start with the enqueue time in milliseconds, so sorting them gives the oldest first.
function listQueueFiles(routine: string): string[] {
  const dir = getQueueDir(routine);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.payload'))
    .sort();
}

export function countQueuedWebhooks(routine: string): number {
  return listQueueFiles(routine).length;
}

export function enqueueWebhook(routine: string, runId: string, payload: string): boolean {
  if (countQueuedWebhooks(routine) >= WEBHOOK_QUEUE_LIMIT) return false;
  const dir = getQueueDir(routine);
  fs.mkdirSync(dir, { recursive: true });
  // Strictly increasing, so webhooks that arrive in the same millisecond keep their order.
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  const queuedAt = String(lastQueuedAt).padStart(15, '0');
  fs.writeFileSync(path.join(dir, `${queuedAt}-${runId}.payload`), payload);
  return true;
}

export function takeQueuedWebhook(routine: string): QueuedWebhook | null {
  const [oldest] = listQueueFiles(routine);
  if (oldest === undefined) return null;
  const file = path.join(getQueueDir(routine), oldest);
  const payload = fs.readFileSync(file, 'utf8');
  fs.rmSync(file);
  const runId = oldest.slice(oldest.indexOf('-') + 1, -'.payload'.length);
  return { runId, payload };
}

export function listQueuedRoutines(): string[] {
  const root = path.join(config.stateDir, 'queue');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(routine => countQueuedWebhooks(routine) > 0);
}
