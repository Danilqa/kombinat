import fs from 'node:fs';
import path from 'node:path';

import type { QueuedWebhook } from 'domains/webhook/types';

import { config } from '../../config';

export const WEBHOOK_QUEUE_LIMIT = 100;
const PREVIEW_CHARS = 2000;

let lastQueuedAt = 0;

export interface QueuedPayload {
  runId: string;
  payload: string;
}

function getQueueDir(routine: string): string {
  return path.join(config.stateDir, 'queue', routine);
}

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
  // Keeps the order of webhooks that arrive in the same millisecond.
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  const queuedAt = String(lastQueuedAt).padStart(15, '0');
  fs.writeFileSync(path.join(dir, `${queuedAt}-${runId}.payload`), payload);
  return true;
}

function getRunId(entry: string): string {
  return entry.slice(entry.indexOf('-') + 1, -'.payload'.length);
}

export function takeQueuedWebhook(routine: string): QueuedPayload | null {
  const [oldest] = listQueueFiles(routine);
  if (oldest === undefined) return null;
  const file = path.join(getQueueDir(routine), oldest);
  const payload = fs.readFileSync(file, 'utf8');
  fs.rmSync(file);
  return { runId: getRunId(oldest), payload };
}

export function listQueuedWebhooks(routine: string): QueuedWebhook[] {
  return listQueueFiles(routine).map(entry => {
    const file = path.join(getQueueDir(routine), entry);
    return {
      runId: getRunId(entry),
      queuedAt: new Date(Number(entry.slice(0, entry.indexOf('-')))).toISOString(),
      bytes: fs.statSync(file).size,
      preview: fs.readFileSync(file, 'utf8').slice(0, PREVIEW_CHARS),
    };
  });
}

export function listQueuedRoutines(): string[] {
  const root = path.join(config.stateDir, 'queue');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(routine => countQueuedWebhooks(routine) > 0);
}
