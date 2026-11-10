import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema, runIdSchema } from 'domains/id/schemas';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { countQueuedWebhooks, enqueueWebhook, listQueuedRoutines, takeQueuedWebhook } =
  await import('./queue');

const triage = routineNameSchema.parse('triage');
const busy = routineNameSchema.parse('busy');

test('webhooks leave the queue oldest first, with their run id and payload', () => {
  assert.equal(takeQueuedWebhook(triage), null);
  enqueueWebhook(triage, runIdSchema.parse('20261109T120000Z-zzzz'), '{"n":1}');
  enqueueWebhook(triage, runIdSchema.parse('20261109T120000Z-aaaa'), '');
  assert.deepEqual(listQueuedRoutines(), ['triage']);
  assert.deepEqual(takeQueuedWebhook(triage), {
    runId: '20261109T120000Z-zzzz',
    payload: '{"n":1}',
  });
  assert.deepEqual(takeQueuedWebhook(triage), { runId: '20261109T120000Z-aaaa', payload: '' });
  assert.equal(countQueuedWebhooks(triage), 0);
  assert.deepEqual(listQueuedRoutines(), []);
});

test('a full queue takes no more webhooks', () => {
  for (let index = 0; index < 100; index++) {
    assert.equal(enqueueWebhook(busy, runIdSchema.parse(`run-${index}`), ''), true);
  }
  assert.equal(enqueueWebhook(busy, runIdSchema.parse('run-100'), ''), false);
  assert.equal(countQueuedWebhooks(busy), 100);
});
