import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { writeSettings } = await import('../settings/storage');
const { deleteExpiredWebhookCalls, listWebhookCalls, logWebhookCall, WEBHOOK_CALL_LIMIT } =
  await import('./call-log');

const triage = routineNameSchema.parse('triage');
const review = routineNameSchema.parse('review');
const runId = runIdSchema.parse('20261119T090000Z-ab12');

function logIgnored(routine: typeof triage, receivedAt: string, body = '{}'): void {
  logWebhookCall(routine, {
    receivedAt: new Date(receivedAt),
    outcome: { outcome: 'ignored', response: null },
    status: 200,
    body: Buffer.from(body),
  });
}

test('deletes the webhook calls older than the run retention once one is set', () => {
  logIgnored(triage, '2026-11-01T09:00:00Z');
  logIgnored(review, '2026-11-02T09:00:00Z');
  logIgnored(triage, '2026-11-19T09:00:00Z');
  const now = new Date('2026-11-20T09:00:00Z');

  assert.deepEqual(deleteExpiredWebhookCalls(now), []);
  writeSettings({ runRetentionDays: 7 });
  assert.deepEqual(
    deleteExpiredWebhookCalls(now)
      .map(call => call.receivedAt)
      .sort(),
    ['2026-11-01T09:00:00.000Z', '2026-11-02T09:00:00.000Z'],
  );
  assert.deepEqual(
    listWebhookCalls(triage).map(call => call.receivedAt),
    ['2026-11-19T09:00:00.000Z'],
  );
  assert.deepEqual(listWebhookCalls(review), []);
});

test('lists the newest calls first with a preview of the body, and keeps only the newest ones', () => {
  const started = new Date('2026-11-20T10:00:00Z');
  logWebhookCall(review, {
    receivedAt: started,
    outcome: { outcome: 'started', runId },
    status: 200,
    body: Buffer.from(`{"title":"${'é'.repeat(600)}"}`),
  });
  logWebhookCall(review, {
    receivedAt: started,
    outcome: { outcome: 'rejected', reason: 'exited with 1: bad signature' },
    status: 401,
    body: Buffer.alloc(0),
  });

  assert.deepEqual(listWebhookCalls(review), [
    {
      id: '001795168800001',
      receivedAt: '2026-11-20T10:00:00.001Z',
      outcome: 'rejected',
      status: 401,
      runId: null,
      reason: 'exited with 1: bad signature',
      bytes: 0,
      preview: '',
    },
    {
      id: '001795168800000',
      receivedAt: '2026-11-20T10:00:00.000Z',
      outcome: 'started',
      status: 200,
      runId,
      reason: null,
      bytes: 1212,
      preview: `{"title":"${'é'.repeat(490)}`,
    },
  ]);

  for (let index = 0; index < WEBHOOK_CALL_LIMIT; index++) {
    logIgnored(review, `2026-11-20T11:${String(index % 60).padStart(2, '0')}:00Z`);
  }
  assert.deepEqual(
    listWebhookCalls(review).map(call => call.outcome),
    Array.from({ length: WEBHOOK_CALL_LIMIT }, () => 'ignored'),
  );
});
