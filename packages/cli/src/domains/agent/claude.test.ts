import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { accountNameSchema, sessionIdSchema } from 'domains/agent/ids';
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
    {
      resultText: 'nope',
      costUsd: 0.5,
      numTurns: null,
      durationMs: null,
      tokens: null,
      error: 'nope',
    },
  );
  assert.equal(
    claudeAgent.getResumeCommand(sessionIdSchema.parse('s1'), null),
    'claude --resume s1',
  );
});

test('reads the calls nobody could approve into blocked actions, with the rules that allow them', () => {
  const denied = (id: string, reason: string) => ({
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: id, content: reason, is_error: true }],
    },
  });
  const result = {
    type: 'result',
    subtype: 'success',
    is_error: false,
    permission_denials: [
      { tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: 'git push' } },
      { tool_name: 'Bash', tool_use_id: 't2', tool_input: { command: 'touch /tmp/notes/a.md' } },
      {
        tool_name: 'Write',
        tool_use_id: 't3',
        tool_input: { file_path: '/notes/today.md', content: 'hi' },
      },
      { tool_name: 'mcp__linear__create_issue', tool_use_id: 't4', tool_input: { title: 'Bug' } },
    ],
  };

  const blocked = claudeAgent.readBlockedActions([
    denied(
      't1',
      'Permission for this tool use was denied. What required approval: This command requires approval',
    ),
    denied(
      't2',
      "Permission for this tool use was denied. What required approval: touch in '/tmp/notes/a.md' needs approval. The path is outside the working directories for this session ('/repo').",
    ),
    result,
  ]);

  assert.deepEqual(blocked, [
    { tool: 'Bash', preview: 'git push', rules: ['Bash(git push *)'] },
    {
      tool: 'Bash',
      preview: 'touch /tmp/notes/a.md',
      rules: ['Bash(touch *)', 'Edit(//tmp/notes/**)'],
    },
    { tool: 'Write', preview: '/notes/today.md', rules: ['Edit(//notes/**)'] },
    {
      tool: 'mcp__linear__create_issue',
      preview: '{"title":"Bug"}',
      rules: ['mcp__linear__create_issue'],
    },
  ]);
});

test('counts the tokens of every model in the result, subagents included', () => {
  const result = {
    type: 'result',
    usage: { input_tokens: 9, output_tokens: 100, cache_read_input_tokens: 1000 },
    modelUsage: {
      'claude-opus-5-5': {
        inputTokens: 9,
        outputTokens: 100,
        cacheCreationInputTokens: 500,
        cacheReadInputTokens: 1000,
      },
      'claude-haiku-4-5': { inputTokens: 1, outputTokens: 20, cacheReadInputTokens: 300 },
    },
  };
  assert.deepEqual(claudeAgent.readEvent(result, makeRunRecord()).tokens, {
    input: 10,
    output: 120,
    cacheWrite: 500,
    cacheRead: 1300,
  });
});

test('falls back to the usage of the result without modelUsage', () => {
  const result = {
    type: 'result',
    usage: {
      input_tokens: 9,
      output_tokens: 100,
      cache_creation_input_tokens: 50,
      cache_read_input_tokens: 1000,
    },
  };
  assert.deepEqual(claudeAgent.readEvent(result, makeRunRecord()).tokens, {
    input: 9,
    output: 100,
    cacheWrite: 50,
    cacheRead: 1000,
  });
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

test('finds the usage limit that cut a turn short, with its reset', () => {
  const rejected = (rateLimitType: string) => ({
    type: 'rate_limit_event',
    rate_limit_info: { status: 'rejected', resetsAt: 1795026600, rateLimitType },
  });
  const limitMessage = {
    type: 'assistant',
    error: 'rate_limit',
    message: { content: [{ type: 'text', text: "You've hit your limit · resets 7:30pm" }] },
  };
  const reply = { type: 'assistant', message: { content: [{ type: 'text', text: 'Done' }] } };
  assert.deepEqual(claudeAgent.findUsageLimitStop([rejected('five_hour'), limitMessage]), {
    limit: 'session',
    resetsAt: '2026-11-18T18:30:00.000Z',
  });
  assert.equal(
    claudeAgent.findUsageLimitStop([rejected('seven_day_opus'), limitMessage])?.limit,
    'week',
  );
  // Extra usage can take over after a rejection, and then the turn goes on.
  assert.equal(claudeAgent.findUsageLimitStop([rejected('five_hour'), reply]), null);
  // A server throttle is a rate_limit error too, but the plan still has usage left.
  assert.equal(
    claudeAgent.findUsageLimitStop([
      { type: 'rate_limit_event', rate_limit_info: { status: 'allowed', resetsAt: 1795026600 } },
      limitMessage,
    ]),
    null,
  );
});

test('waits out usage limits unless the routine says fail', () => {
  assert.equal(claudeAgent.resolveSettings(makeAgentTask()).onUsageLimit, 'wait');
  assert.equal(
    claudeAgent.resolveSettings(makeAgentTask({ onUsageLimit: 'fail' })).onUsageLimit,
    'fail',
  );
  assert.throws(
    () => claudeAgent.resolveSettings(makeAgentTask({ onUsageLimit: 'retry' })),
    /onUsageLimit must be one of wait, fail/,
  );
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

test("a routine on an account runs, resumes, signs in and checks its login with that account's config folder", () => {
  const work = accountNameSchema.parse('work');
  const context = {
    routine: makeAgentTask({ account: work }),
    runId: runIdSchema.parse('r1'),
    trigger: 'manual' as const,
  };
  const folder = path.join(os.homedir(), '.claude-work');
  assert.equal(claudeAgent.buildInvocation(context).env['CLAUDE_CONFIG_DIR'], folder);
  const reply =
    claudeAgent.buildReplyInvocation(context, sessionIdSchema.parse('s1'), {
      text: 'Go on',
      source: 'dashboard',
    }) ?? assert.fail('claude continues sessions');
  assert.equal(reply.env['CLAUDE_CONFIG_DIR'], folder);
  const login = claudeAgent.buildLoginInvocation(work) ?? assert.fail('claude has a login');
  assert.deepEqual(login.args, ['auth', 'login']);
  assert.equal(login.env['CLAUDE_CONFIG_DIR'], folder);
  const status = claudeAgent.buildLoginStatusInvocation(work) ?? assert.fail('claude has a login');
  assert.deepEqual(status.args, ['auth', 'status']);
  assert.equal(status.env['CLAUDE_CONFIG_DIR'], folder);
  assert.equal(
    claudeAgent.getResumeCommand(sessionIdSchema.parse('s1'), work),
    'CLAUDE_CONFIG_DIR=~/.claude-work claude --resume s1',
  );
  const primary = claudeAgent.buildInvocation({ ...context, routine: makeAgentTask() });
  assert.equal(primary.env['CLAUDE_CONFIG_DIR'], process.env['CLAUDE_CONFIG_DIR']);
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

test('allows the rules of the message for the resumed session only', () => {
  const task = {
    routine: makeAgentTask(),
    runId: runIdSchema.parse('r1'),
    trigger: 'manual' as const,
  };
  const message = { text: 'These are allowed now', source: 'dashboard' as const };
  const { args } =
    claudeAgent.buildReplyInvocation(task, sessionIdSchema.parse('s1'), {
      ...message,
      allowedTools: ['Bash(git push *)', 'Edit(//My Notes/**)'],
    }) ?? assert.fail('claude continues sessions');

  assert.deepEqual(args.slice(args.indexOf('--allowedTools'), args.indexOf('--resume')), [
    '--allowedTools',
    'Bash(git push *)',
    '--allowedTools',
    'Edit(//My Notes/**)',
  ]);
  assert.equal(claudeAgent.buildInvocation(task).args.includes('--allowedTools'), false);
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
