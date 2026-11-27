import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { makeRunRecord } from 'domains/run/mocks';

import { appendLogEvent, readLastMessage, readRunEvents } from './event-log';

test('reads the logged events and skips lines that are not JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-event-log-'));
  const logFile = path.join(dir, 'run.jsonl');
  fs.writeFileSync(
    logFile,
    '{"type":"output","text":"a"}\nnot json\n\n{"type":"output","text":"b"}\n',
  );
  assert.deepEqual(readRunEvents(makeRunRecord({ logFile })), [
    { type: 'output', text: 'a' },
    { type: 'output', text: 'b' },
  ]);
  assert.deepEqual(readRunEvents(makeRunRecord({ logFile: path.join(dir, 'missing.jsonl') })), []);
});

test('reads the last message sent to a run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-event-log-'));
  const record = makeRunRecord({ logFile: path.join(dir, 'run.jsonl') });
  assert.equal(readLastMessage(record), null);
  appendLogEvent(record, { type: 'message', text: 'Open a PR', source: 'dashboard' });
  appendLogEvent(record, { type: 'reply_error', error: 'failed' });
  appendLogEvent(record, { type: 'message', text: 'Try again', source: 'webhook' });
  assert.deepEqual(readLastMessage(record), { text: 'Try again', source: 'webhook' });
});
