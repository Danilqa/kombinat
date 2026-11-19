import fs from 'node:fs';
import path from 'node:path';

import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import { webhookCallIdSchema } from 'domains/webhook/ids';
import { webhookCallSchema } from 'domains/webhook/schemas';
import type { WebhookCall } from 'domains/webhook/types';
import { findExpiredWebhookCalls } from 'domains/webhook/utils';

import { config } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { readSettings } from '../settings/storage';
import type { WebhookOutcome } from './receive';

export const WEBHOOK_CALL_LIMIT = 100;
const PREVIEW_CHARS = 500;

const storedWebhookCallSchema = webhookCallSchema
  .omit({ bytes: true, preview: true })
  .extend({ body: z.string() });

type StoredWebhookCall = z.infer<typeof storedWebhookCallSchema>;

type LoggedOutcome = Pick<StoredWebhookCall, 'outcome' | 'runId' | 'reason'>;

export interface WebhookCallEntry {
  receivedAt: Date;
  outcome: WebhookOutcome;
  status: number;
  body: Buffer;
}

let lastReceivedAt = 0;

function getCallsRoot(): string {
  return path.join(config.stateDir, 'webhooks');
}

function getCallsDir(routine: RoutineName): string {
  return path.join(getCallsRoot(), routine);
}

function listCallFiles(routine: RoutineName): string[] {
  const dir = getCallsDir(routine);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(entry => entry.endsWith('.json'))
    .sort()
    .reverse();
}

function readCalls(routine: RoutineName): StoredWebhookCall[] {
  return listCallFiles(routine).flatMap(
    entry => readJsonFile(path.join(getCallsDir(routine), entry), storedWebhookCallSchema) ?? [],
  );
}

// A routine without a webhook has no calls to show.
function toLoggedOutcome(outcome: WebhookOutcome): LoggedOutcome | null {
  return match(outcome)
    .with({ outcome: 'no_webhook' }, () => null)
    .with({ outcome: P.union('started', 'continued', 'queued') }, ({ outcome, runId }) => ({
      outcome,
      runId,
      reason: null,
    }))
    .with({ outcome: 'rejected' }, ({ outcome, reason }) => ({ outcome, runId: null, reason }))
    .with(
      { outcome: P.union('ignored', 'timed_out', 'disabled', 'queue_full') },
      ({ outcome }) => ({
        outcome,
        runId: null,
        reason: null,
      }),
    )
    .exhaustive();
}

export function logWebhookCall(routine: RoutineName, entry: WebhookCallEntry): void {
  const logged = toLoggedOutcome(entry.outcome);
  if (logged === null) return;
  const dir = getCallsDir(routine);
  fs.mkdirSync(dir, { recursive: true });
  // Keeps the order of calls that arrive in the same millisecond.
  lastReceivedAt = Math.max(entry.receivedAt.getTime(), lastReceivedAt + 1);
  const id = webhookCallIdSchema.parse(String(lastReceivedAt).padStart(15, '0'));
  const call: StoredWebhookCall = {
    id,
    receivedAt: new Date(lastReceivedAt).toISOString(),
    ...logged,
    status: entry.status,
    body: entry.body.toString('utf8'),
  };
  writeJsonFile(path.join(dir, `${id}.json`), call);
  for (const old of listCallFiles(routine).slice(WEBHOOK_CALL_LIMIT)) {
    fs.rmSync(path.join(dir, old), { force: true });
  }
}

export function listWebhookCalls(routine: RoutineName): WebhookCall[] {
  return readCalls(routine).map(({ body, ...call }) => ({
    ...call,
    bytes: Buffer.byteLength(body),
    preview: body.slice(0, PREVIEW_CHARS),
  }));
}

export function deleteExpiredWebhookCalls(now = new Date()): StoredWebhookCall[] {
  const { runRetentionDays } = readSettings();
  const root = getCallsRoot();
  if (runRetentionDays === null || !fs.existsSync(root)) return [];
  return fs.readdirSync(root).flatMap(entry => {
    const routine = routineNameSchema.parse(entry);
    const expired = findExpiredWebhookCalls(readCalls(routine), runRetentionDays, now);
    for (const call of expired) {
      fs.rmSync(path.join(getCallsDir(routine), `${call.id}.json`), { force: true });
    }
    return expired;
  });
}
