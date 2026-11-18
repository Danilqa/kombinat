import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionIdSchema } from 'domains/agent/ids';
import { runIdSchema } from 'domains/run/ids';
import { makeRunRecord } from 'domains/run/mocks';

import { claudeAgent } from './claude';
import { expectInit, expectResult, expectText, expectTool, makeAgentTask } from './testing';

const events = [
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
  const items = claudeAgent.buildTranscript(events);
  assert.deepEqual(
    items.map(item => item.kind),
    ['init', 'text', 'tool', 'tool', 'result'],
  );
  const [init, text, bash, read, result] = items;
  assert.equal(expectInit(init).toolCount, 3);
  assert.equal(expectText(text).text, 'Looking at the logs');
  assert.equal(expectTool(bash).preview, 'git status');
  assert.deepEqual(expectTool(bash).result, { content: 'clean', isError: false });
  assert.equal(expectTool(read).isSubagent, true);
  assert.deepEqual(expectTool(read).result, { content: 'boom', isError: true });
  assert.equal(expectResult(result).numTurns, 3);
});

test('tool calls without a result yet have a null result', () => {
  const bash = claudeAgent.buildTranscript(events.slice(0, 3))[2];
  assert.equal(expectTool(bash).result, null);
});

test('reads the session and the result into the run record', () => {
  const record = makeRunRecord();
  assert.deepEqual(claudeAgent.readEvent(events[0], record), { model: 'claude-opus-5-5' });
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
  assert.equal(claudeAgent.getResumeCommand(sessionIdSchema.parse('s1')), 'claude --resume s1');
});

test('reads the plan limits that a rate limit event reports', () => {
  const rateLimit = (info: unknown) => ({ type: 'rate_limit_event', rate_limit_info: info });
  assert.deepEqual(
    claudeAgent.readPlanLimits(
      rateLimit({
        status: 'allowed',
        unifiedWindows: {
          five_hour: { utilization: 0.12, resetsAt: 1795026600 },
          seven_day: { utilization: 0.2, resetsAt: 1795557600 },
        },
      }),
    ),
    {
      session: { usedRatio: 0.12, resetsAt: '2026-11-18T18:30:00.000Z' },
      week: { usedRatio: 0.2, resetsAt: '2026-11-24T22:00:00.000Z' },
    },
  );
  assert.deepEqual(
    claudeAgent.readPlanLimits(
      rateLimit({ unifiedWindows: { seven_day: { utilization: 0.5, resetsAt: 1795557600 } } }),
    ),
    { session: null, week: { usedRatio: 0.5, resetsAt: '2026-11-24T22:00:00.000Z' } },
  );
  assert.equal(claudeAgent.readPlanLimits(rateLimit({ status: 'allowed' })), null);
  assert.equal(claudeAgent.readPlanLimits(events[0]), null);
});

test('passes the routine settings to claude -p', () => {
  const { args, input, env } = claudeAgent.buildInvocation({
    routine: makeAgentTask({
      model: 'claude-sonnet-5-5',
      effort: 'low',
      permissionMode: 'auto',
      maxBudgetUsd: 2,
    }),
    runId: runIdSchema.parse('r1'),
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

test('passes the fallback models to claude -p', () => {
  const buildArgs = (fallbackModel: string | null): string[] =>
    claudeAgent.buildInvocation({
      routine: makeAgentTask({ model: 'claude-opus-5-5', fallbackModel }),
      runId: runIdSchema.parse('r1'),
      trigger: 'schedule',
    }).args;
  const args = buildArgs('claude-sonnet-5-5, claude-haiku-4-5');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5-5');
  assert.equal(args[args.indexOf('--fallback-model') + 1], 'claude-sonnet-5-5,claude-haiku-4-5');
  assert.equal(buildArgs(null).includes('--fallback-model'), false);
});

test('resumes the session with the message and a note about the dashboard', () => {
  const { args, input } =
    claudeAgent.buildReplyInvocation(
      {
        routine: makeAgentTask({ effort: 'low' }),
        runId: runIdSchema.parse('r1'),
        trigger: 'manual',
      },
      sessionIdSchema.parse('s1'),
      { text: 'Open a PR with the fix', source: 'dashboard' },
    ) ?? assert.fail('claude continues sessions');
  assert.equal(input, 'Open a PR with the fix');
  assert.equal(args[args.indexOf('--resume') + 1], 's1');
  assert.equal(args[args.indexOf('--effort') + 1], 'low');
  assert.match(
    args[args.indexOf('--append-system-prompt') + 1] ?? '',
    /message from the dashboard/,
  );
});

test('says when the message came from a webhook', () => {
  const { args } =
    claudeAgent.buildReplyInvocation(
      { routine: makeAgentTask(), runId: runIdSchema.parse('r1'), trigger: 'webhook' },
      sessionIdSchema.parse('s1'),
      { text: 'Fix the flaky test too', source: 'webhook' },
    ) ?? assert.fail('claude continues sessions');
  assert.match(args[args.indexOf('--append-system-prompt') + 1] ?? '', /message from a webhook/);
});

test('a model fallback switches the model of the run and shows in the transcript', () => {
  const fallback = {
    type: 'system',
    subtype: 'model_fallback',
    trigger: 'overloaded',
    original_model: 'claude-opus-5-5',
    fallback_model: 'claude-sonnet-5-5',
    content: 'Switched to Sonnet 5.5 because claude-opus-5-5 is overloaded',
  };
  assert.deepEqual(claudeAgent.readEvent(fallback, makeRunRecord()), {
    model: 'claude-sonnet-5-5',
  });
  const [init, switched] = claudeAgent.buildTranscript([events[0], fallback]);
  assert.equal(expectInit(init).model, 'claude-opus-5-5');
  assert.deepEqual(switched, {
    kind: 'model-fallback',
    key: 'fallback-1',
    from: 'claude-opus-5-5',
    to: 'claude-sonnet-5-5',
    reason: 'overloaded',
  });
});
