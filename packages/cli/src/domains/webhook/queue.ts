import fs from 'node:fs';
import path from 'node:path';

import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import { runIdSchema, type RunId } from 'domains/run/ids';
import type { QueuedWebhook } from 'domains/webhook/types';

import { config } from '../../config';

export const WEBHOOK_QUEUE_LIMIT = 100;
const PREVIEW_CHARS = 2000;

let lastQueuedAt = 0;

export interface WebhookRun {
  runId: RunId;
  payload: string;
  conversation: string | null;
}

function getQueueDir(routine: RoutineName): string {
  return path.join(config.stateDir, 'queue', routine);
}

function listQueueFiles(routine: RoutineName): string[] {
  const dir = getQueueDir(routine);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.payload'))
    .sort();
}

export function countQueuedWebhooks(routine: RoutineName): number {
  return listQueueFiles(routine).length;
}

function getConversationFile(routine: RoutineName, entry: string): string {
  return path.join(getQueueDir(routine), `${entry.slice(0, -'.payload'.length)}.conversation`);
}

function readConversation(routine: RoutineName, entry: string): string | null {
  const file = getConversationFile(routine, entry);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

export function enqueueWebhook(routine: RoutineName, webhook: WebhookRun): boolean {
  if (countQueuedWebhooks(routine) >= WEBHOOK_QUEUE_LIMIT) return false;
  const dir = getQueueDir(routine);
  fs.mkdirSync(dir, { recursive: true });
  // Keeps the order of webhooks that arrive in the same millisecond.
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  const entry = `${String(lastQueuedAt).padStart(15, '0')}-${webhook.runId}.payload`;
  // Before the payload, since a webhook is queued once its payload file exists.
  if (webhook.conversation !== null) {
    fs.writeFileSync(getConversationFile(routine, entry), webhook.conversation);
  }
  fs.writeFileSync(path.join(dir, entry), webhook.payload);
  return true;
}

function getRunId(entry: string): RunId {
  return runIdSchema.parse(entry.slice(entry.indexOf('-') + 1, -'.payload'.length));
}

export function takeQueuedWebhook(routine: RoutineName): WebhookRun | null {
  const [oldest] = listQueueFiles(routine);
  if (oldest === undefined) return null;
  const file = path.join(getQueueDir(routine), oldest);
  const payload = fs.readFileSync(file, 'utf8');
  const conversation = readConversation(routine, oldest);
  fs.rmSync(file);
  fs.rmSync(getConversationFile(routine, oldest), { force: true });
  return { runId: getRunId(oldest), payload, conversation };
}

export function findQueuedConversation(routine: RoutineName, conversation: string): RunId | null {
  const entry = listQueueFiles(routine).find(
    candidate => readConversation(routine, candidate) === conversation,
  );
  return entry === undefined ? null : getRunId(entry);
}

export function listQueuedWebhooks(routine: RoutineName): QueuedWebhook[] {
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

export function listQueuedRoutines(): RoutineName[] {
  const root = path.join(config.stateDir, 'queue');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .map(entry => routineNameSchema.parse(entry))
    .filter(routine => countQueuedWebhooks(routine) > 0);
}
