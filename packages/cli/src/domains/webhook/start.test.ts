import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { sessionIdSchema } from 'domains/agent/ids';
import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { getQueuedWebhookRunId } = await import('./start');
const { enqueueWebhook } = await import('./queue');
const { makeWebhook } = await import('./mocks');
const { writeRunRecord } = await import('../run/storage');
const { startDetachedRun } = await import('../run/launcher');
const { makeRunRecord } = await import('domains/run/mocks');

const chat = routineNameSchema.parse('chat');

test('a queued webhook answers with the run its conversation continues or starts', () => {
  writeRunRecord(
    makeRunRecord({
      id: runIdSchema.parse('r1'),
      routine: chat,
      status: 'succeeded',
      sessionId: sessionIdSchema.parse('s1'),
      resumeCommand: 'claude --resume s1',
      conversation: 'issue-1',
    }),
  );
  writeRunRecord(
    makeRunRecord({
      id: runIdSchema.parse('r2'),
      routine: chat,
      status: 'failed',
      conversation: 'issue-2',
    }),
  );
  writeRunRecord(
    makeRunRecord({
      id: runIdSchema.parse('r3'),
      routine: chat,
      status: 'running',
      pid: process.pid,
      conversation: 'issue-4',
    }),
  );
  enqueueWebhook(chat, makeWebhook('q1', 'Hi', 'issue-2'));

  assert.equal(getQueuedWebhookRunId(chat, makeWebhook('new', 'Hi')), 'new');
  assert.equal(getQueuedWebhookRunId(chat, makeWebhook('new', 'Hi', 'issue-1')), 'r1');
  assert.equal(getQueuedWebhookRunId(chat, makeWebhook('new', 'Hi', 'issue-2')), 'q1');
  assert.equal(getQueuedWebhookRunId(chat, makeWebhook('new', 'Hi', 'issue-3')), 'new');
  assert.equal(getQueuedWebhookRunId(chat, makeWebhook('new', 'Hi', 'issue-4')), 'r3');
});

test('a queued webhook answers with the run of its conversation that is still starting', () => {
  const starting = routineNameSchema.parse('missing-routine');
  startDetachedRun(starting, {
    trigger: 'webhook',
    runId: runIdSchema.parse('s1'),
    conversation: 'issue-1',
  });
  assert.equal(getQueuedWebhookRunId(starting, makeWebhook('new', 'Hi', 'issue-1')), 's1');
  assert.equal(getQueuedWebhookRunId(starting, makeWebhook('new', 'Hi', 'issue-2')), 'new');
});
