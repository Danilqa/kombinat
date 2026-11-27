import assert from 'node:assert/strict';
import { test } from 'node:test';

import { match } from 'ts-pattern';

import { buildRunTranscript } from './transcript';

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

test('the check comes first, the after hook last, and hook keys count every hook in order', () => {
  const events = [
    { type: 'check', command: 'gh pr list', exitCode: 0, output: '#482' },
    { type: 'before_hook', command: 'git pull', exitCode: 0, output: 'Already up to date.' },
    { type: 'output', text: 'Hello' },
    { type: 'after_hook', command: 'notify-slack', exitCode: 1, output: 'no webhook url' },
  ];
  const { eventCount, items } = buildRunTranscript('command', events);
  assert.equal(eventCount, 4);
  assert.deepEqual(
    items.map(item => [
      item.kind,
      item.key,
      match(item)
        .with({ kind: 'hook' }, hook => hook.phase)
        .otherwise(() => null),
    ]),
    [
      ['hook', 'hook-0', 'check'],
      ['hook', 'hook-1', 'before'],
      ['text', 'output', null],
      ['hook', 'hook-2', 'after'],
    ],
  );
  assert.deepEqual(items[3], {
    kind: 'hook',
    key: 'hook-2',
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

test('a usage limit wait replaces the result it cut short, and the continued session follows it', () => {
  const wait = {
    limit: 'session',
    stoppedAt: '2026-11-19T07:06:00Z',
    continuesAt: '2026-11-19T08:11:00Z',
  } as const;
  const events = [
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Found the race' }] } },
    { type: 'result', result: "You've hit your limit", is_error: true, num_turns: 3 },
    { type: 'usage_limit_wait', ...wait },
    { type: 'usage_limit_end', at: '2026-11-19T07:30:00Z', outcome: 'continued' },
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Fixed it' }] } },
    { type: 'result', result: 'Fixed it', is_error: false, num_turns: 2 },
    { type: 'after_hook', command: 'notify-slack', exitCode: 0, output: '' },
  ];
  const { eventCount, items } = buildRunTranscript('claude', events);
  assert.equal(eventCount, events.length);
  assert.deepEqual(
    items.map(item => [item.kind, item.key]),
    [
      ['init', 'init-0'],
      ['text', '1-0'],
      ['usage-limit', 'usage-limit-0'],
      ['text', 'resume-1-1-0'],
      ['result', 'resume-1-result-2'],
      ['hook', 'hook-0'],
    ],
  );
  assert.deepEqual(items[2], {
    kind: 'usage-limit',
    key: 'usage-limit-0',
    ...wait,
    end: { at: '2026-11-19T07:30:00Z', outcome: 'continued' },
  });
});

test('a retry replaces the result of the attempt that stopped, and the next attempt continues the session', () => {
  const retry = {
    attempt: 2,
    attempts: 3,
    error: 'API Error: Stream idle timeout - partial response received',
    stoppedAt: '2026-11-22T02:06:00Z',
    continuesAt: '2026-11-22T02:11:00Z',
    continuesSession: true,
  };
  const events = [
    { type: 'before_hook', command: 'git pull', exitCode: 0, output: '' },
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'result', result: retry.error, is_error: true, num_turns: 3 },
    { type: 'retry_wait', ...retry },
    { type: 'retry_end', at: '2026-11-22T02:11:30Z', outcome: 'retried' },
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'result', result: 'Fixed it', is_error: false, num_turns: 2 },
    { type: 'after_hook', command: 'notify-slack', exitCode: 0, output: '' },
  ];
  const { items } = buildRunTranscript('claude', events);
  assert.deepEqual(
    items.map(item => [item.kind, item.key]),
    [
      ['hook', 'hook-0'],
      ['init', 'init-0'],
      ['retry', 'retry-0'],
      ['result', 'resume-1-result-1'],
      ['hook', 'hook-1'],
    ],
  );
  assert.deepEqual(items[2], {
    kind: 'retry',
    key: 'retry-0',
    ...retry,
    end: { at: '2026-11-22T02:11:30Z', outcome: 'retried' },
  });
});

test('a usage limit that is still being waited out has no end', () => {
  const events = [
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5', cwd: '/repo' },
    { type: 'result', result: "You've hit your limit", is_error: true, num_turns: 3 },
    {
      type: 'usage_limit_wait',
      limit: 'week',
      stoppedAt: '2026-11-19T07:06:00Z',
      continuesAt: '2026-11-24T08:01:00Z',
    },
  ];
  assert.deepEqual(
    buildRunTranscript('claude', events).items.map(item =>
      match(item)
        .with({ kind: 'usage-limit' }, ({ limit, end }) => [item.kind, limit, end])
        .otherwise(() => [item.kind]),
    ),
    [['init'], ['usage-limit', 'week', null]],
  );
});
