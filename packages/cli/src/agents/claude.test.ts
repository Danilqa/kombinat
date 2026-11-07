import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeRunRecord } from 'domains/run/mocks';

import { buildRoutine } from '../routines';
import { expectInit, expectResult, expectText, expectTool } from '../testing';
import { buildTranscript } from './index';
import { claudeAgent } from './claude';

const events = [
  { type: 'before_hook', command: 'ensure-docker.sh', exitCode: 0, output: '' },
  {
    type: 'system',
    subtype: 'init',
    model: 'claude-opus-5-5',
    cwd: '/repo',
    tools: [1, 2, 3],
    permissionMode: 'auto',
  },
  { type: 'system', subtype: 'hook_started' },
  {
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'Looking at the logs' },
        { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'git status\ngit log' } },
      ],
    },
  },
  {
    type: 'assistant',
    parent_tool_use_id: 't0',
    message: {
      content: [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/repo/a.ts' } }],
    },
  },
  {
    type: 'user',
    message: {
      content: [
        { type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: 'clean' }] },
      ],
    },
  },
  {
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 't2', content: 'boom', is_error: true }],
    },
  },
  { type: 'result', result: 'All done', is_error: false, num_turns: 3, duration_ms: 4200 },
];

test('builds transcript items from the stream-json events', () => {
  const { eventCount, items } = buildTranscript('claude', events);
  assert.equal(eventCount, events.length);
  assert.deepEqual(
    items.map(item => item.kind),
    ['hook', 'init', 'text', 'tool', 'tool', 'result'],
  );
  const [hook, init, text, bash, read, result] = items;
  assert.deepEqual(hook, {
    kind: 'hook',
    key: 'hook-0',
    command: 'ensure-docker.sh',
    exitCode: 0,
    output: '',
  });
  assert.equal(expectInit(init).toolCount, 3);
  assert.equal(expectText(text).text, 'Looking at the logs');
  assert.equal(expectTool(bash).preview, 'git status');
  assert.deepEqual(expectTool(bash).result, { content: 'clean', isError: false });
  assert.equal(expectTool(read).isSubagent, true);
  assert.deepEqual(expectTool(read).result, { content: 'boom', isError: true });
  assert.equal(expectResult(result).numTurns, 3);
});

test('tool calls without a result yet have a null result', () => {
  const bash = buildTranscript('claude', events.slice(0, 4)).items[3];
  assert.equal(expectTool(bash).result, null);
});

test('reads the session and the result into the run record', () => {
  const record = makeRunRecord();
  assert.deepEqual(claudeAgent.readEvent(events[1], record), { model: 'claude-opus-5-5' });
  assert.deepEqual(
    claudeAgent.readEvent({ type: 'system', subtype: 'init', session_id: 's1' }, record),
    { sessionId: 's1' },
  );
  assert.deepEqual(
    claudeAgent.readEvent(
      { type: 'result', result: 'nope', is_error: true, total_cost_usd: 0.5 },
      record,
    ),
    { resultText: 'nope', costUsd: 0.5, numTurns: null, durationMs: null, error: 'nope' },
  );
  assert.equal(claudeAgent.getResumeCommand('s1'), 'claude --resume s1');
});

test('passes the routine settings to claude -p', () => {
  const routine = buildRoutine(
    '/tmp/demo.md',
    '---\nname: demo\ncwd: /tmp\nmodel: claude-sonnet-5-5\neffort: low\nmaxBudgetUsd: 2\n---\nHello',
  );
  const { args, input, env } = claudeAgent.buildInvocation({
    routine,
    runId: 'r1',
    trigger: 'manual',
  });
  assert.equal(input, 'Hello');
  assert.equal(env['ANTHROPIC_API_KEY'], undefined);
  assert.deepEqual(args.slice(0, 4), ['-p', '--output-format', 'stream-json', '--verbose']);
  assert.equal(args[args.indexOf('--model') + 1], 'claude-sonnet-5-5');
  assert.equal(args[args.indexOf('--effort') + 1], 'low');
  assert.equal(args[args.indexOf('--permission-mode') + 1], 'auto');
  assert.equal(args[args.indexOf('--max-budget-usd') + 1], '2');
});
