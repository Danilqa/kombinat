import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { match } from 'ts-pattern';

import { makeRunRecord } from 'domains/run/mocks';

import { buildRunTranscript, readRunEvents } from './event-log';

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
