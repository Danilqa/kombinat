import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildRoutine } from '../routines';
import type { RunRecord } from '../state';
import { codexAgent } from './codex';
import { buildTranscript } from './index';

const events = [
  { type: 'thread.started', thread_id: 'thread-1' },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'item_0', type: 'reasoning', text: 'Thinking' } },
  {
    type: 'item.started',
    item: { id: 'item_1', type: 'command_execution', command: 'ls', status: 'in_progress' },
  },
  {
    type: 'item.completed',
    item: {
      id: 'item_1',
      type: 'command_execution',
      command: 'ls',
      aggregated_output: 'a.ts',
      exit_code: 0,
      status: 'completed',
    },
  },
  {
    type: 'item.completed',
    item: {
      id: 'item_2',
      type: 'file_change',
      changes: [{ path: 'a.ts', kind: 'update' }],
      status: 'completed',
    },
  },
  {
    type: 'item.completed',
    item: {
      id: 'item_3',
      type: 'mcp_tool_call',
      server: 'github',
      tool: 'get_pr',
      arguments: { number: 1 },
      result: { content: [{ type: 'text', text: 'PR 1' }] },
      status: 'completed',
    },
  },
  {
    type: 'item.completed',
    item: { id: 'item_4', type: 'todo_list', items: [{ text: 'Fix', completed: true }] },
  },
  { type: 'item.completed', item: { id: 'item_5', type: 'agent_message', text: 'Done' } },
  { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } },
];

test('builds transcript items from codex exec --json events', () => {
  const { items } = buildTranscript('codex', events);
  assert.deepEqual(
    items.map(item => item.kind),
    ['init', 'tool', 'tool', 'tool', 'text', 'text', 'result'],
  );
  const [, shell, edit, mcp, todo, message, result] = items;
  assert.ok(shell?.kind === 'tool' && edit?.kind === 'tool' && mcp?.kind === 'tool');
  assert.equal(shell.preview, 'ls');
  assert.deepEqual(shell.result, { content: 'a.ts', isError: false });
  assert.equal(edit.preview, 'update a.ts');
  assert.equal(mcp.name, 'github.get_pr');
  assert.deepEqual(mcp.result, { content: 'PR 1', isError: false });
  assert.equal(todo?.kind === 'text' && todo.text, '- [x] Fix');
  assert.equal(message?.kind === 'text' && message.text, 'Done');
  assert.equal(result?.kind === 'result' && result.numTurns, 1);
});

test('a running command has no result yet', () => {
  const shell = buildTranscript('codex', events.slice(0, 4)).items[1];
  assert.equal(shell?.kind === 'tool' && shell.result, null);
});

test('a failed turn ends the transcript with an error result', () => {
  const { items } = buildTranscript('codex', [
    { type: 'turn.failed', error: { message: 'usage limit reached' } },
  ]);
  assert.deepEqual(items.at(-1), {
    kind: 'result',
    key: 'result-0',
    text: 'usage limit reached',
    isError: true,
    costUsd: null,
    numTurns: 0,
    durationMs: null,
  });
});

test('reads the thread, the last message, turns and failures into the run record', () => {
  const record = { numTurns: null } as RunRecord;
  assert.deepEqual(codexAgent.readEvent(events[0], record), { sessionId: 'thread-1' });
  assert.deepEqual(codexAgent.readEvent(events[8], record), { resultText: 'Done' });
  assert.deepEqual(codexAgent.readEvent(events[9], record), { numTurns: 1 });
  assert.deepEqual(codexAgent.readEvent({ type: 'turn.failed', error: { message: 'x' } }, record), {
    error: 'x',
  });
  assert.equal(codexAgent.getResumeCommand('thread-1'), 'codex resume thread-1');
});

test('passes the routine settings to codex exec', () => {
  const routine = buildRoutine(
    '/tmp/demo.md',
    '---\nname: demo\nagent: codex\ncwd: /tmp\nmodel: gpt-5.5\neffort: high\n---\nHello',
  );
  const { args, input, env } = codexAgent.buildInvocation({
    routine,
    runId: 'r1',
    trigger: 'schedule',
  });
  assert.deepEqual(args, [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
    '--model',
    'gpt-5.5',
    '--config',
    'model_reasoning_effort="high"',
    '-',
  ]);
  assert.match(input, /unattended by the kombinat scheduler[\s\S]*\n\nHello$/);
  assert.equal(env['OPENAI_API_KEY'], undefined);
});
