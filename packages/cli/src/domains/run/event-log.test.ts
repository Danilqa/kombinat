import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { match } from 'ts-pattern';

import { makeRunRecord } from 'domains/run/mocks';

import { appendChatEvent, buildRunTranscript, readLastMessage, readRunEvents } from './event-log';

test('the before hook comes first and every logged event is counted', () => {
  const events = [
    { type: 'before_hook', command: 'ensure-docker.sh', exitCode: 0, output: '' },
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'system', subtype: 'hook_started' },
    { type: 'result', result: 'All done', is_error: false, num_turns: 3, duration_ms: 4200 },
  ];
  const { eventCount, items } = buildRunTranscript('claude', events);
  assert.equal(eventCount, events.length);
  assert.deepEqual(
    items.map(item => item.kind),
    ['hook', 'init', 'result'],
  );
  assert.deepEqual(items[0], {
    kind: 'hook',
    key: 'hook-0',
    command: 'ensure-docker.sh',
    exitCode: 0,
    output: '',
    phase: 'before',
  });
});

test('the after hook comes last and hook keys count every hook in order', () => {
  const events = [
    { type: 'before_hook', command: 'git pull', exitCode: 0, output: 'Already up to date.' },
    { type: 'output', text: 'Hello' },
    { type: 'after_hook', command: 'notify-slack', exitCode: 1, output: 'no webhook url' },
  ];
  const { eventCount, items } = buildRunTranscript('command', events);
  assert.equal(eventCount, 3);
  assert.deepEqual(
    items.map(item => [
      item.kind,
      item.key,
      match(item)
        .with({ kind: 'hook' }, hook => hook.phase)
        .otherwise(() => null),
    ]),
    [
      ['hook', 'hook-0', 'before'],
      ['text', 'output', null],
      ['hook', 'hook-1', 'after'],
    ],
  );
  assert.deepEqual(items[2], {
    kind: 'hook',
    key: 'hook-1',
    command: 'notify-slack',
    exitCode: 1,
    output: 'no webhook url',
    phase: 'after',
  });
});

test('an after hook alone, as after a failed preflight, is the only item', () => {
  const events = [{ type: 'after_hook', command: 'notify-slack', exitCode: 0, output: '' }];
  assert.deepEqual(buildRunTranscript('command', events).items, [
    {
      kind: 'hook',
      key: 'hook-0',
      command: 'notify-slack',
      exitCode: 0,
      output: '',
      phase: 'after',
    },
  ]);
});

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

test('each message is followed by its reply, after the after hook of the run', () => {
  const events = [
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'result', result: 'Found the bug', is_error: false, num_turns: 3, duration_ms: 4200 },
    { type: 'after_hook', command: 'notify-slack', exitCode: 0, output: '' },
    { type: 'message', text: 'Open a PR with the fix' },
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Opened #12' }] } },
    { type: 'result', result: 'Opened #12', is_error: false, num_turns: 1, duration_ms: 900 },
    { type: 'message', text: 'Merge it', source: 'webhook' },
    { type: 'reply_error', error: 'claude binary not found' },
  ];
  const { eventCount, items } = buildRunTranscript('claude', events);
  assert.equal(eventCount, events.length);
  assert.deepEqual(
    items.map(item => [item.kind, item.key]),
    [
      ['init', 'init-0'],
      ['result', 'result-1'],
      ['hook', 'hook-0'],
      ['message', 'reply-0'],
      ['text', 'reply-0-1-0'],
      ['result', 'reply-0-result-2'],
      ['message', 'reply-1'],
      ['text', 'reply-1-error'],
    ],
  );
  assert.deepEqual(items[3], {
    kind: 'message',
    key: 'reply-0',
    text: 'Open a PR with the fix',
    source: 'dashboard',
  });
  assert.deepEqual(items[6], {
    kind: 'message',
    key: 'reply-1',
    text: 'Merge it',
    source: 'webhook',
  });
  assert.deepEqual(items.at(-1), {
    kind: 'text',
    key: 'reply-1-error',
    text: '**Error:** claude binary not found',
    isSubagent: false,
  });
});

test('reads the last message sent to a run', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-event-log-'));
  const record = makeRunRecord({ logFile: path.join(dir, 'run.jsonl') });
  assert.equal(readLastMessage(record), null);
  appendChatEvent(record, { type: 'message', text: 'Open a PR', source: 'dashboard' });
  appendChatEvent(record, { type: 'reply_error', error: 'failed' });
  appendChatEvent(record, { type: 'message', text: 'Try again', source: 'webhook' });
  assert.deepEqual(readLastMessage(record), { text: 'Try again', source: 'webhook' });
});
