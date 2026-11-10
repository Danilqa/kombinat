import assert from 'node:assert/strict';
import { test } from 'node:test';

import { runIdSchema, sessionIdSchema } from 'domains/id/schemas';
import { makeRunRecord } from 'domains/run/mocks';

import { codexAgent } from './codex';
import { expectResult, expectText, expectTool, makeAgentTask } from './testing';

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
  const items = codexAgent.buildTranscript(events);
  assert.deepEqual(
    items.map(item => item.kind),
    ['init', 'tool', 'tool', 'tool', 'text', 'text', 'result'],
  );
  const [, shell, edit, mcp, todo, message, result] = items;
  assert.equal(expectTool(shell).preview, 'ls');
  assert.deepEqual(expectTool(shell).result, { content: 'a.ts', isError: false });
  assert.equal(expectTool(edit).preview, 'update a.ts');
  assert.equal(expectTool(mcp).name, 'github.get_pr');
  assert.deepEqual(expectTool(mcp).result, { content: 'PR 1', isError: false });
  assert.equal(expectText(todo).text, '- [x] Fix');
  assert.equal(expectText(message).text, 'Done');
  assert.equal(expectResult(result).numTurns, 1);
});

test('a running command has no result yet', () => {
  const shell = codexAgent.buildTranscript(events.slice(0, 4))[1];
  assert.equal(expectTool(shell).result, null);
});

test('a failed turn ends the transcript with an error result', () => {
  const items = codexAgent.buildTranscript([
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
  const record = makeRunRecord();
  assert.deepEqual(codexAgent.readEvent(events[0], record), { sessionId: 'thread-1' });
  assert.deepEqual(codexAgent.readEvent(events[8], record), { resultText: 'Done' });
  assert.deepEqual(codexAgent.readEvent(events[9], record), { numTurns: 1 });
  assert.deepEqual(codexAgent.readEvent({ type: 'turn.failed', error: { message: 'x' } }, record), {
    error: 'x',
  });
  assert.equal(
    codexAgent.getResumeCommand(sessionIdSchema.parse('thread-1')),
    'codex resume thread-1',
  );
});

test('passes the routine settings to codex exec', () => {
  const { args, input, env } = codexAgent.buildInvocation({
    routine: makeAgentTask({ model: 'gpt-5.5', effort: 'high', permissionMode: 'workspace-write' }),
    runId: runIdSchema.parse('r1'),
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
