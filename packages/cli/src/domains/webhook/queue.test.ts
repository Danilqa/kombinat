import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const {
  countQueuedWebhooks,
  enqueueWebhook,
  findQueuedConversation,
  listQueuedRoutines,
  listQueuedWebhooks,
  takeQueuedWebhook,
} = await import('./queue');
const { makeWebhook } = await import('./mocks');

const triage = routineNameSchema.parse('triage');
const busy = routineNameSchema.parse('busy');
const chat = routineNameSchema.parse('chat');

test('webhooks leave the queue oldest first, with their run id and payload', () => {
  assert.equal(takeQueuedWebhook(triage), null);
  enqueueWebhook(triage, makeWebhook('20261109T120000Z-zzzz', '{"n":1}'));
  enqueueWebhook(triage, makeWebhook('20261109T120000Z-aaaa', ''));
  assert.deepEqual(listQueuedRoutines(), ['triage']);
  assert.deepEqual(takeQueuedWebhook(triage), makeWebhook('20261109T120000Z-zzzz', '{"n":1}'));
  assert.deepEqual(takeQueuedWebhook(triage), makeWebhook('20261109T120000Z-aaaa', ''));
  assert.equal(countQueuedWebhooks(triage), 0);
  assert.deepEqual(listQueuedRoutines(), []);
});

test('a full queue takes no more webhooks', () => {
  for (let index = 0; index < 100; index++) {
    assert.equal(enqueueWebhook(busy, makeWebhook(`run-${index}`, '')), true);
  }
  assert.equal(enqueueWebhook(busy, makeWebhook('run-100', '', 'session-1')), false);
  assert.equal(countQueuedWebhooks(busy), 100);
  assert.equal(findQueuedConversation(busy, 'session-1'), null);
});

test('a queued webhook keeps its conversation, and the first one queued for it is found', () => {
  enqueueWebhook(chat, makeWebhook('20261118T120000Z-aaaa', 'Plain'));
  enqueueWebhook(chat, makeWebhook('20261118T120000Z-bbbb', 'Start', 'session-1'));
  enqueueWebhook(chat, makeWebhook('20261118T120000Z-cccc', 'Follow up', 'session-1'));
  assert.equal(countQueuedWebhooks(chat), 3);
  assert.deepEqual(
    listQueuedWebhooks(chat).map(webhook => webhook.preview),
    ['Plain', 'Start', 'Follow up'],
  );
  assert.equal(findQueuedConversation(chat, 'session-1'), '20261118T120000Z-bbbb');
  assert.equal(findQueuedConversation(chat, 'session-2'), null);
  assert.deepEqual(takeQueuedWebhook(chat), makeWebhook('20261118T120000Z-aaaa', 'Plain'));
  assert.deepEqual(
    takeQueuedWebhook(chat),
    makeWebhook('20261118T120000Z-bbbb', 'Start', 'session-1'),
  );
  assert.equal(findQueuedConversation(chat, 'session-1'), '20261118T120000Z-cccc');
  takeQueuedWebhook(chat);
  assert.deepEqual(fs.readdirSync(path.join(tmp, 'state', 'queue', 'chat')), []);
});
