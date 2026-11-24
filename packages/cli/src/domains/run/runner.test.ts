import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

import { isMatching, P } from 'ts-pattern';
import { z } from 'zod';

import { spawnSync } from 'node:child_process';

import { sessionIdSchema } from 'domains/agent/ids';
import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema, type RunId } from 'domains/run/ids';
import { runRecordSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-')));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');
process.env['CODEX_BIN'] = path.join(tmp, 'missing-codex');
// A fake claude whose result makes the run record larger than any pipe buffer.
const bigResultFile = path.join(tmp, 'big-result.jsonl');
fs.writeFileSync(
  bigResultFile,
  `${JSON.stringify({ type: 'result', result: 'x'.repeat(250_000), is_error: false, num_turns: 1 })}\n`,
);
// In a folder with limited.jsonl, it stops at a usage limit and its resumed session finishes.
// In a folder with answer.jsonl, it keeps its prompt in prompt.txt and answers with the file.
// In a folder with calls.jsonl, it writes the file, and with stopped.jsonl it then waits for Ctrl-C.
const fakeClaude = path.join(tmp, 'fake-claude');
fs.writeFileSync(
  fakeClaude,
  `#!/bin/sh
if [ -f calls.jsonl ]; then
  cat > /dev/null
  cat calls.jsonl
  if [ -f stopped.jsonl ]; then
    trap 'kill $! 2> /dev/null; cat stopped.jsonl; exit 0' INT
    sleep 30 > /dev/null 2>&1 &
    wait
  fi
  exit 0
fi
if [ -f answer.jsonl ]; then
  cat > prompt.txt
  cat answer.jsonl
  exit 0
fi
cat > /dev/null
if [ -f limited.jsonl ]; then
  echo "$@" >> args.txt
  case "$*" in *--resume*) cat resumed.jsonl; exit 0 ;; esac
  cat limited.jsonl
  exit 1
fi
cat '${bigResultFile}'
`,
  { mode: 0o755 },
);
process.env['CLAUDE_BIN'] = fakeClaude;
// The user's git config, such as commit signing, stays out of the tests.
fs.writeFileSync(
  path.join(tmp, 'gitconfig'),
  '[user]\n\tname = Test\n\temail = test@example.com\n',
);
process.env['GIT_CONFIG_GLOBAL'] = path.join(tmp, 'gitconfig');
process.env['GIT_CONFIG_NOSYSTEM'] = '1';

const { config } = await import('../../config');
const { buildRoutine } = await import('../routine/utils');
const { readMemory, readRoutineMemory, writeMemory } = await import('../routine/memory');
const { appendLogEvent, buildRunTranscript, readRunEvents } = await import('./event-log');
const { writeCheckError, writePayload, writePrompt } = await import('./payload');
const {
  checkIsRunning,
  checkIsStarting,
  replyToRun,
  runRoutine,
  startDetachedRun,
  startDetachedRuns,
} = await import('./runner');
const { cancelQueuedRuns, readQueuedRuns } = await import('./queued-runs');
const { checkIsProcessAlive, listRuns, readRunRecord, writeRunRecord } = await import('./storage');
const { requestWaitAction } = await import('./usage-limit');
const { makeRunRecord } = await import('domains/run/mocks');

function makeRoutine(name: string, frontmatter: string) {
  return buildRoutine(
    path.join(tmp, `${name}.md`),
    `---\ncwd: ${tmp}\nagent: command\ncommand: echo Hello\n${frontmatter}\n---\nDo it.`,
  );
}

const logLineSchema = z.object({ type: z.string() });
const hookLineSchema = z.object({ exitCode: z.number().nullable(), output: z.string() });

function readLog(record: RunRecord): unknown[] {
  return fs
    .readFileSync(record.logFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line): unknown => JSON.parse(line));
}

function readLogTypes(record: RunRecord): string[] {
  return readLog(record).map(event => logLineSchema.parse(event).type);
}

function findAfterHookLines(record: RunRecord): unknown[] {
  return readLog(record).filter(isMatching({ type: 'after_hook' }));
}

interface RecordWrite {
  status: RunRecord['status'];
  pid: number | null;
}

// Lists every write of the run's record, with the status and pid it wrote.
function watchRecordWrites(t: TestContext, routine: string, runId: RunId): RecordWrite[] {
  const recordFile = path.join(tmp, 'state', 'runs', routine, `${runId}.json`);
  const renameSync = fs.renameSync.bind(fs);
  const writes: RecordWrite[] = [];
  t.mock.method(fs, 'renameSync', (from: fs.PathLike, to: fs.PathLike) => {
    renameSync(from, to);
    if (String(to) !== recordFile) return;
    const { status, pid } = runRecordSchema.parse(JSON.parse(fs.readFileSync(to, 'utf8')));
    writes.push({ status, pid });
  });
  return writes;
}

const HOOK_SCRIPT = `out=$(dirname "$0")
pwd -P > "$out/cwd.txt"
printf '%s\\n' "$KOMBINAT_ROUTINE" "$KOMBINAT_RUN_ID" "$KOMBINAT_TRIGGER" "$KOMBINAT_RUN_STATUS" "$KOMBINAT_REPO" "$PATH" > "$out/env.txt"
runs="$KOMBINAT_STATE_DIR/runs/$KOMBINAT_ROUTINE"
cp "$runs/$KOMBINAT_RUN_ID.json" "$out/during.json"
cp "$runs/$KOMBINAT_RUN_ID.jsonl" "$out/during.jsonl" 2> /dev/null
cat > "$out/stdin.json"
echo hook done
`;

interface HookCapture {
  cwd: string;
  env: string[];
  stdin: unknown;
  during: RunRecord;
  duringLog: string;
}

function makeRecordingHook(name: string): string {
  const dir = path.join(tmp, 'hooks', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'hook.sh'), HOOK_SCRIPT);
  return `after: sh ${path.join(dir, 'hook.sh')}`;
}

function readHookCapture(name: string): HookCapture {
  const dir = path.join(tmp, 'hooks', name);
  const read = (file: string) => fs.readFileSync(path.join(dir, file), 'utf8');
  return {
    cwd: read('cwd.txt').trim(),
    env: read('env.txt').trimEnd().split('\n'),
    stdin: JSON.parse(read('stdin.json')),
    during: runRecordSchema.parse(JSON.parse(read('during.json'))),
    duringLog: fs.existsSync(path.join(dir, 'during.jsonl')) ? read('during.jsonl') : '',
  };
}

test('a command that ignores the prompt still finishes its run', async () => {
  // Larger than a pipe buffer, so the command exits before the whole prompt is written.
  const prompt = 'Say hello.\n'.repeat(30_000);
  const routine = buildRoutine(
    path.join(tmp, 'say-hello.md'),
    `---\ncwd: ${tmp}\nagent: command\ncommand: echo Hello\n---\n${prompt}`,
  );
  const record = await runRoutine(routine, { trigger: 'manual' });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.resultText, 'Hello');
});

test('a webhook run gets its payload at the end of the prompt', async () => {
  const routine = buildRoutine(
    path.join(tmp, 'echo-payload.md'),
    `---\ncwd: ${tmp}\nagent: command\ncommand: cat\n---\nTriage.`,
  );
  const runId = runIdSchema.parse('20261109T120000Z-abcd');
  writePayload(routine.name, runId, '{"number":42}');
  const record = await runRoutine(routine, { trigger: 'webhook', runId });
  assert.equal(record.id, runId);
  assert.equal(record.status, 'succeeded');
  assert.equal(
    record.resultText,
    'Triage.\n\nThis run was started by a webhook. Its request body:\n\n```\n{"number":42}\n```\n',
  );
  assert.deepEqual(
    fs
      .readdirSync(path.join(tmp, 'state', 'runs', 'echo-payload'))
      .filter(file => file.endsWith('.payload')),
    [],
  );
});

test('a run started with a changed prompt gets it instead of the routine prompt, once', async () => {
  const routine = buildRoutine(
    path.join(tmp, 'echo-prompt.md'),
    `---\ncwd: ${tmp}\nagent: command\ncommand: cat\n---\nTriage.`,
  );
  const runId = runIdSchema.parse('20261118T090000Z-prmt');
  writePrompt(routine.name, runId, 'Triage only the newest issue.');
  const changed = await runRoutine(routine, { trigger: 'manual', runId });
  assert.equal(changed.resultText, 'Triage only the newest issue.');
  const next = await runRoutine(routine, { trigger: 'manual' });
  assert.equal(next.resultText, 'Triage.');
});

test('a run started for a conversation keeps it on its record', async () => {
  const routine = makeRoutine('conversation', '');
  const record = await runRoutine(routine, { trigger: 'webhook', conversation: 'issue-1' });
  assert.equal(record.conversation, 'issue-1');
  assert.equal(readRunRecord(routine.name, record.id)?.conversation, 'issue-1');
});

test('a started run counts as starting until its record appears or time runs out', () => {
  const routine = routineNameSchema.parse('missing-routine');
  const runId = runIdSchema.parse('20261109T120000Z-wxyz');
  startDetachedRun(routine, { trigger: 'manual', runId });
  assert.equal(checkIsStarting(routine), true);
  assert.equal(checkIsStarting(routine, Date.now() + 5 * 60_000), false);
  startDetachedRun(routine, { trigger: 'manual', runId });
  writeRunRecord(makeRunRecord({ id: runId, routine, status: 'running' }));
  assert.equal(checkIsStarting(routine), false);
});

test('a start of several runs gives each the prompt, and its queued runs keep the routine running until they are cancelled', () => {
  const routine = routineNameSchema.parse('missing-batch');
  const readPrompt = (id: RunId) =>
    fs.readFileSync(path.join(config.stateDir, 'runs', routine, `${id}.prompt`), 'utf8');
  const firstId = startDetachedRuns(
    routine,
    { trigger: 'manual' },
    { count: 3, maxParallel: 1, prompt: 'Fix the oldest bug' },
  );
  const queuedIds = readQueuedRuns().map(({ id }) => id);
  assert.equal(queuedIds.length, 2);
  for (const id of [firstId, ...queuedIds]) assert.equal(readPrompt(id), 'Fix the oldest bug');

  writeRunRecord(makeRunRecord({ id: firstId, routine, status: 'succeeded' }));
  assert.equal(checkIsRunning(routine), true);
  cancelQueuedRuns(routine);
  assert.equal(checkIsRunning(routine), false);
  assert.deepEqual(readQueuedRuns(), []);
  for (const id of queuedIds) assert.throws(() => readPrompt(id), { code: 'ENOENT' });
});

test('without an after hook a run writes its record as before and logs no after hook', async t => {
  const runId = runIdSchema.parse('20261110T090000Z-noaf');
  const writes = watchRecordWrites(t, 'no-after', runId);
  const record = await runRoutine(makeRoutine('no-after', ''), { trigger: 'manual', runId });
  assert.equal(record.status, 'succeeded');
  assert.deepEqual(
    writes.map(write => write.status),
    ['running', 'succeeded'],
  );
  assert.deepEqual(findAfterHookLines(record), []);

  const failedId = runIdSchema.parse('20261110T090000Z-nocw');
  const failedWrites = watchRecordWrites(t, 'no-after-no-cwd', failedId);
  const failed = await runRoutine(
    makeRoutine('no-after-no-cwd', `cwd: ${path.join(tmp, 'nowhere')}`),
    { trigger: 'manual', runId: failedId },
  );
  assert.equal(failed.status, 'failed');
  assert.deepEqual(
    failedWrites.map(write => write.status),
    ['failed'],
  );
  assert.equal(fs.existsSync(failed.logFile), false);
});

test('the after hook gets the finished run on stdin and its env, while the run still counts as running', async t => {
  const runId = runIdSchema.parse('20261110T090000Z-succ');
  const writes = watchRecordWrites(t, 'after-success', runId);
  const record = await runRoutine(makeRoutine('after-success', makeRecordingHook('success')), {
    trigger: 'webhook',
    runId,
  });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.resultText, 'Hello');

  const hook = readHookCapture('success');
  assert.equal(hook.cwd, tmp);
  assert.deepEqual(hook.env.slice(0, 5), [
    'after-success',
    runId,
    'webhook',
    'succeeded',
    config.projectRoot,
  ]);
  assert.ok((hook.env.at(5) ?? '').startsWith(`${path.join(config.projectRoot, 'scripts')}:`));
  assert.deepEqual(hook.stdin, record);
  assert.deepEqual(readRunRecord(record.routine, record.id), record);

  assert.equal(hook.during.status, 'running');
  assert.equal(hook.during.endedAt, null);
  assert.equal(hook.during.pid, process.pid);
  assert.equal(checkIsProcessAlive(hook.during.pid), true);
  assert.match(hook.duringLog, /"text":"Hello"/);
  assert.doesNotMatch(hook.duringLog, /after_hook/);

  assert.deepEqual(
    writes.map(write => write.status),
    ['running', 'running', 'succeeded'],
  );
  assert.deepEqual(
    writes.map(write => write.pid),
    [record.pid, process.pid, record.pid],
  );
  const log = readLog(record);
  assert.deepEqual(log.at(-1), {
    type: 'after_hook',
    command: `sh ${path.join(tmp, 'hooks', 'success', 'hook.sh')}`,
    exitCode: 0,
    output: 'hook done',
  });
});

test('the after hook runs after a failed agent', async () => {
  const record = await runRoutine(
    makeRoutine('after-failure', `command: echo oops >&2; exit 2\n${makeRecordingHook('failure')}`),
    { trigger: 'schedule' },
  );
  assert.equal(record.status, 'failed');
  assert.equal(record.exitCode, 2);
  const hook = readHookCapture('failure');
  assert.equal(hook.env[3], 'failed');
  assert.deepEqual(hook.stdin, record);
  assert.equal(findAfterHookLines(record).length, 1);
});

test('the after hook runs after a timeout', async () => {
  const record = await runRoutine(
    makeRoutine(
      'after-timeout',
      `command: exec sleep 5\ntimeoutMinutes: 0.005\n${makeRecordingHook('timeout')}`,
    ),
    { trigger: 'manual' },
  );
  assert.equal(record.status, 'timed_out');
  const hook = readHookCapture('timeout');
  assert.equal(hook.env[3], 'timed_out');
  assert.deepEqual(hook.stdin, record);
  assert.equal(findAfterHookLines(record).length, 1);
});

test('the after hook runs in the project folder when the cwd is missing', async t => {
  const runId = runIdSchema.parse('20261110T090000Z-mcwd');
  const writes = watchRecordWrites(t, 'after-missing-cwd', runId);
  const record = await runRoutine(
    makeRoutine(
      'after-missing-cwd',
      `cwd: ${path.join(tmp, 'nowhere')}\n${makeRecordingHook('missing-cwd')}`,
    ),
    { trigger: 'manual', runId },
  );
  assert.equal(record.status, 'failed');
  assert.match(record.error ?? '', /cwd does not exist/);
  const hook = readHookCapture('missing-cwd');
  assert.equal(hook.cwd, fs.realpathSync(config.projectRoot));
  assert.equal(hook.env[3], 'failed');
  assert.deepEqual(hook.stdin, record);
  assert.equal(hook.during.status, 'running');
  assert.equal(hook.during.pid, process.pid);
  assert.deepEqual(writes, [
    { status: 'running', pid: process.pid },
    { status: 'failed', pid: null },
  ]);
  assert.deepEqual(readLogTypes(record), ['after_hook']);
});

test('the after hook runs when the agent binary is missing', async () => {
  const record = await runRoutine(
    makeRoutine('after-missing-binary', `agent: codex\ncommand:\n${makeRecordingHook('binary')}`),
    { trigger: 'manual' },
  );
  assert.equal(record.status, 'failed');
  assert.match(record.error ?? '', /codex binary not found/);
  const hook = readHookCapture('binary');
  assert.deepEqual(hook.env.slice(0, 4), ['after-missing-binary', record.id, 'manual', 'failed']);
  assert.deepEqual(hook.stdin, record);
});

test('the after hook runs when the before hook fails', async () => {
  const record = await runRoutine(
    makeRoutine('after-before-fails', `before: exit 4\n${makeRecordingHook('before')}`),
    { trigger: 'manual' },
  );
  assert.equal(record.status, 'failed');
  assert.match(record.error ?? '', /before hook exited with 4/);
  const hook = readHookCapture('before');
  assert.deepEqual(hook.stdin, record);
  assert.deepEqual(readLogTypes(record), ['before_hook', 'after_hook']);
});

test('an after hook that fails leaves the run alone and is logged', async () => {
  const record = await runRoutine(makeRoutine('after-hook-fails', 'after: echo nope >&2; exit 3'), {
    trigger: 'manual',
  });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.exitCode, 0);
  assert.equal(record.error, null);
  assert.deepEqual(readRunRecord(record.routine, record.id), record);
  assert.deepEqual(findAfterHookLines(record), [
    { type: 'after_hook', command: 'echo nope >&2; exit 3', exitCode: 3, output: 'nope' },
  ]);
});

test('an after hook that runs past its limit is stopped, leaves the run alone and is logged', async () => {
  const startedAt = Date.now();
  const record = await runRoutine(
    makeRoutine('after-hook-slow', 'after: echo started; sleep 5; echo never'),
    { trigger: 'manual' },
    300,
  );
  assert.ok(Date.now() - startedAt < 3000);
  assert.equal(record.status, 'succeeded');
  assert.deepEqual(readRunRecord(record.routine, record.id), record);
  const [line] = findAfterHookLines(record);
  const { exitCode, output } = hookLineSchema.parse(line);
  assert.equal(exitCode, null);
  assert.match(output, /^started\nKilled after /);
});

test('an after hook that never reads a large record on stdin does not hang or fail', async () => {
  for (const after of ['sleep 0.2', 'true']) {
    const name = `after-ignores-stdin-${after.split(' ')[0]}`;
    const record = await runRoutine(
      buildRoutine(path.join(tmp, `${name}.md`), `---\ncwd: ${tmp}\nafter: ${after}\n---\nDo it.`),
      { trigger: 'manual' },
    );
    assert.equal(record.status, 'succeeded');
    assert.ok(JSON.stringify(record).length > 200_000);
    assert.deepEqual(findAfterHookLines(record), [
      { type: 'after_hook', command: after, exitCode: 0, output: '' },
    ]);
  }
});

async function checkIsGoneSoon(pid: number): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!checkIsProcessAlive(pid)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

test('a hook past its limit is killed with the children it started', async () => {
  const pidFile = path.join(tmp, 'hook-child.pid');
  const record = await runRoutine(
    makeRoutine('after-hook-child', `after: sleep 30 & echo $! > ${pidFile}; wait; echo never`),
    { trigger: 'manual' },
    300,
  );
  assert.equal(record.status, 'succeeded');
  const childPid = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.ok(childPid > 0);
  assert.equal(await checkIsGoneSoon(childPid), true);
  const [line] = findAfterHookLines(record);
  assert.match(hookLineSchema.parse(line).output, /^Killed after 0\.005 minutes$/);
});

test('a before hook past its limit fails the run as killed, and the after hook still runs', async () => {
  const record = await runRoutine(
    makeRoutine(
      'before-hook-slow',
      `before: echo waiting; sleep 5\n${makeRecordingHook('before-slow')}`,
    ),
    { trigger: 'manual' },
    300,
  );
  assert.equal(record.status, 'failed');
  assert.equal(record.error, 'before hook was killed after 0.005 minutes');
  assert.equal(readHookCapture('before-slow').env[3], 'failed');
  const [before] = readLog(record);
  assert.deepEqual(before, {
    type: 'before_hook',
    command: 'echo waiting; sleep 5',
    exitCode: null,
    output: 'waiting\nKilled after 0.005 minutes',
  });
  assert.deepEqual(readLogTypes(record), ['before_hook', 'after_hook']);
});

test('a run whose check failed fails before its hooks and agent start, and the after hook still runs', async () => {
  const routine = makeRoutine(
    'check-failed',
    `worktree: true\nbefore: echo before\n${makeRecordingHook('check')}`,
  );
  const runId = runIdSchema.parse('20261122T120000Z-chck');
  writeCheckError(routine.name, runId, 'check exited with 4: gh: not logged in');
  const record = await runRoutine(routine, { trigger: 'schedule', runId });
  assert.equal(record.status, 'failed');
  assert.equal(record.error, 'check exited with 4: gh: not logged in');
  assert.equal(record.worktree, null);
  assert.deepEqual(readLogTypes(record), ['after_hook']);
  assert.deepEqual(readHookCapture('check').stdin, record);
});

test('a before hook that exits non-zero fails the run with its output', async () => {
  const record = await runRoutine(makeRoutine('before-hook-exits', 'before: echo no >&2; exit 5'), {
    trigger: 'manual',
  });
  assert.equal(record.status, 'failed');
  assert.equal(record.error, 'before hook exited with 5: no');
});

test('the finished record is written even when the after hook step throws', async () => {
  const runsDir = path.join(tmp, 'state', 'runs', 'after-hook-throws');
  await assert.rejects(
    runRoutine(makeRoutine('after-hook-throws', `command: exit 2\nafter: rm -rf ${runsDir}`), {
      trigger: 'manual',
      runId: runIdSchema.parse('20261110T090000Z-thrw'),
    }),
    /ENOENT/,
  );
  const stored = readRunRecord(
    routineNameSchema.parse('after-hook-throws'),
    runIdSchema.parse('20261110T090000Z-thrw'),
  );
  assert.ok(stored);
  assert.equal(stored.status, 'failed');
  assert.equal(stored.exitCode, 2);
  assert.notEqual(stored.endedAt, null);
});

function makeFinishedRun(
  routine: string,
  id: string,
  overrides: Partial<RunRecord> = {},
): RunRecord {
  const runId = runIdSchema.parse(id);
  const runsDir = path.join(tmp, 'state', 'runs', routine);
  fs.mkdirSync(runsDir, { recursive: true });
  const run = makeRunRecord({
    id: runId,
    routine: routineNameSchema.parse(routine),
    status: 'succeeded',
    endedAt: '2026-10-06T11:05:00Z',
    sessionId: sessionIdSchema.parse('s1'),
    resumeCommand: 'claude --resume s1',
    resultText: 'Found the bug',
    logFile: path.join(runsDir, `${runId}.jsonl`),
    ...overrides,
  });
  fs.writeFileSync(run.logFile, '');
  writeRunRecord(run);
  return run;
}

test('a reply resumes the session with the last message and leaves the outcome of the run alone', async () => {
  const routine = buildRoutine(path.join(tmp, 'chat.md'), `---\ncwd: ${tmp}\n---\nFind the bug.`);
  const run = makeFinishedRun('chat', '20261117T090000Z-chat');
  appendLogEvent(run, { type: 'message', text: 'Open a PR with the fix', source: 'dashboard' });
  const finished = await replyToRun(routine, run);
  assert.deepEqual(finished, run);
  assert.deepEqual(readRunRecord(run.routine, run.id), run);
  assert.deepEqual(readLogTypes(run), ['message', 'result']);
});

const blockedPush = { tool: 'Bash', preview: 'git push', rules: ['Bash(git push *)'] };

function appendAllowPushMessage(run: RunRecord) {
  appendLogEvent(run, {
    type: 'message',
    text: 'These are allowed now',
    source: 'dashboard',
    allowedTools: ['Bash(git push *)'],
  });
}

test('a reply with allowed rules resumes the session with them and keeps what is still blocked', async () => {
  const cwd = path.join(tmp, 'allowed');
  fs.mkdirSync(cwd, { recursive: true });
  fs.writeFileSync(path.join(cwd, 'limited.jsonl'), '');
  fs.writeFileSync(
    path.join(cwd, 'resumed.jsonl'),
    JSON.stringify({
      type: 'result',
      result: 'Pushed the branch. Opening the pull request needs approval.',
      is_error: false,
      permission_denials: [
        { tool_name: 'Bash', tool_use_id: 't1', tool_input: { command: 'gh pr create --fill' } },
      ],
    }),
  );
  const routine = buildRoutine(path.join(tmp, 'allowed.md'), `---\ncwd: ${cwd}\n---\nFix it.`);
  const run = makeFinishedRun('allowed', '20261117T090000Z-alow', {
    blockedActions: [blockedPush],
  });
  appendAllowPushMessage(run);

  const finished = await replyToRun(routine, run);

  assert.match(
    fs.readFileSync(path.join(cwd, 'args.txt'), 'utf8'),
    /--allowedTools Bash\(git push \*\) --resume s1$/m,
  );
  assert.equal(finished.resultText, run.resultText);
  assert.deepEqual(finished.blockedActions, [
    { tool: 'Bash', preview: 'gh pr create --fill', rules: ['Bash(gh pr create *)'] },
  ]);
});

test('a reply with allowed rules that fails leaves the blocked actions on the run', async () => {
  const routine = makeRoutine('allow-fails', '');
  const run = makeFinishedRun('allow-fails', '20261117T090000Z-alfl', {
    blockedActions: [blockedPush],
  });
  appendAllowPushMessage(run);

  const finished = await replyToRun(routine, run);

  assert.deepEqual(finished.blockedActions, [blockedPush]);
  assert.deepEqual(readRunRecord(run.routine, run.id)?.blockedActions, [blockedPush]);
});

test('a reply that cannot start logs why', async () => {
  const routine = makeRoutine('chat-command', '');
  const run = makeFinishedRun('chat-command', '20261117T090000Z-cmnd', { agent: 'command' });
  appendLogEvent(run, { type: 'message', text: 'Again', source: 'dashboard' });
  const finished = await replyToRun(routine, run);
  assert.equal(finished.replyPid, null);
  assert.deepEqual(readLog(run).at(-1), {
    type: 'reply_error',
    error: 'This command run has no session to continue',
  });
});

test('a replying run keeps its routine running until its reply process is gone', () => {
  const run = makeFinishedRun('chat-busy', '20261117T090000Z-busy', { replyPid: process.pid });
  assert.equal(checkIsRunning(run.routine), true);
  writeRunRecord({ ...run, replyPid: spawnSync('true').pid });
  assert.equal(checkIsRunning(run.routine), false);
  assert.equal(listRuns(run.routine)[0]?.replyPid, null);
  assert.deepEqual(readLog(run), [{ type: 'reply_error', error: 'Reply process disappeared' }]);
});

// A claude routine in its own folder whose agent ends its message with the text.
function makeAnsweringRoutine(name: string, answer: string, frontmatter = 'memory: true') {
  const cwd = path.join(tmp, name);
  fs.mkdirSync(cwd, { recursive: true });
  fs.writeFileSync(
    path.join(cwd, 'answer.jsonl'),
    [
      { type: 'system', subtype: 'init', session_id: 's1' },
      { type: 'assistant', message: { content: [{ type: 'text', text: answer }] } },
      { type: 'result', result: answer, is_error: false, num_turns: 1 },
    ]
      .map(event => JSON.stringify(event))
      .join('\n'),
  );
  const routine = buildRoutine(
    path.join(tmp, `${name}.md`),
    `---\ncwd: ${cwd}\n${frontmatter}\n---\nFind design bugs.`,
  );
  return { routine, readPrompt: () => fs.readFileSync(path.join(cwd, 'prompt.txt'), 'utf8') };
}

test('a run reads the notes of the last runs and saves the notes it ends with', async () => {
  const { routine, readPrompt } = makeAnsweringRoutine(
    'remembers',
    'Filed #512.\n\n<routine-memory>\n- Sign in as qa\n- #512 filed\n</routine-memory>',
  );
  writeMemory(routine.name, '- Sign in as qa', { by: 'user' });
  const finished = await runRoutine(routine, { trigger: 'manual' });
  assert.match(readPrompt(), /^Find design bugs\.\n[\s\S]*\n- Sign in as qa\n<\/routine-memory>/);
  assert.equal(finished.resultText, 'Filed #512.');
  assert.equal(readRunRecord(routine.name, finished.id)?.resultText, 'Filed #512.');
  assert.equal(readMemory(routine.name), '- Sign in as qa\n- #512 filed');
  assert.equal(readRoutineMemory(routine.name).change?.runId, finished.id);
  const texts = buildRunTranscript('claude', readRunEvents(finished)).items.flatMap(item =>
    isMatching({ kind: P.union('text', 'result') }, item) ? [item.text] : [],
  );
  assert.deepEqual(texts, ['Filed #512.', 'Filed #512.']);
});

test('a reply gets the notes as they are now and can change them', async () => {
  const { routine, readPrompt } = makeAnsweringRoutine(
    'remembers-reply',
    'Noted.\n<routine-memory>\n- Skip the beta banner\n</routine-memory>',
  );
  const run = makeFinishedRun(routine.name, '20261117T090000Z-mmry');
  writeMemory(routine.name, '- Edited after the run', { by: 'user' });
  appendLogEvent(run, { type: 'message', text: 'Skip the beta banner', source: 'dashboard' });
  await replyToRun(routine, run);
  assert.match(readPrompt(), /^Skip the beta banner\n[\s\S]*- Edited after the run/);
  assert.equal(readMemory(routine.name), '- Skip the beta banner');
  assert.equal(readRoutineMemory(routine.name).change?.runId, run.id);
  appendLogEvent(run, { type: 'message', text: 'Thanks', source: 'dashboard' });
  await replyToRun(routine, run);
  assert.match(readPrompt(), /^Thanks\n\nIf your notes need to change/);
  assert.doesNotMatch(readPrompt(), /- Skip the beta banner/);
});

test('a reply sends the notes again only after someone else changed them', async () => {
  const { routine, readPrompt } = makeAnsweringRoutine('remembers-once', 'Done.');
  writeMemory(routine.name, '- Sign in as qa', { by: 'user' });
  const run = makeFinishedRun(routine.name, '20261117T090000Z-once', {
    startedAt: new Date().toISOString(),
  });
  const reply = async (text: string) => {
    appendLogEvent(run, { type: 'message', text, source: 'dashboard' });
    await replyToRun(routine, readRunRecord(run.routine, run.id) ?? run);
    return readPrompt();
  };
  assert.doesNotMatch(await reply('Open a PR'), /- Sign in as qa/);
  writeMemory(routine.name, '- Sign in as admin', { by: 'user' });
  assert.match(await reply('Merge it'), /- Sign in as admin/);
  assert.doesNotMatch(await reply('Thanks'), /- Sign in as admin/);
});

test('a reply that never reached the session sends the notes again with the next one', async () => {
  const { routine, readPrompt } = makeAnsweringRoutine('remembers-retry', 'Done.');
  const run = makeFinishedRun(routine.name, '20261117T090000Z-rtry');
  writeMemory(routine.name, '- Sign in as admin', { by: 'user' });
  appendLogEvent(run, { type: 'message', text: 'Open a PR', source: 'dashboard' });
  await replyToRun({ ...routine, cwd: path.join(tmp, 'missing-cwd') }, run);
  appendLogEvent(run, { type: 'message', text: 'Try again', source: 'dashboard' });
  await replyToRun(routine, readRunRecord(run.routine, run.id) ?? run);
  assert.match(readPrompt(), /^Try again\n[\s\S]*- Sign in as admin/);
});

test('a routine without memory: true gets no notes and keeps its whole message', async () => {
  const answer = 'Done\n<routine-memory>\n- Not saved\n</routine-memory>';
  const { routine, readPrompt } = makeAnsweringRoutine('forgets', answer, '');
  const finished = await runRoutine(routine, { trigger: 'manual' });
  assert.equal(readPrompt(), 'Find design bugs.');
  assert.equal(finished.resultText, answer);
  assert.equal(readMemory(routine.name), '');
});

const LIMIT_MESSAGE = "You've hit your limit · resets 8pm";

// A routine whose claude stops at the 5-hour limit, which resets in an hour.
function makeLimitedRoutine(name: string, frontmatter = '') {
  const cwd = path.join(tmp, name);
  fs.mkdirSync(cwd, { recursive: true });
  const toLines = (events: unknown[]) => events.map(event => JSON.stringify(event)).join('\n');
  fs.writeFileSync(
    path.join(cwd, 'limited.jsonl'),
    toLines([
      { type: 'system', subtype: 'init', session_id: 's1' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Found the race' }] } },
      {
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'rejected',
          resetsAt: Math.floor(Date.now() / 1000) + 3600,
          rateLimitType: 'five_hour',
        },
      },
      {
        type: 'assistant',
        error: 'rate_limit',
        message: { content: [{ type: 'text', text: LIMIT_MESSAGE }] },
      },
      {
        type: 'result',
        result: LIMIT_MESSAGE,
        is_error: true,
        num_turns: 3,
        total_cost_usd: 0.5,
        usage: { input_tokens: 10, output_tokens: 200, cache_read_input_tokens: 3000 },
      },
    ]),
  );
  fs.writeFileSync(
    path.join(cwd, 'resumed.jsonl'),
    toLines([
      { type: 'system', subtype: 'init', session_id: 's1' },
      {
        type: 'result',
        result: 'Fixed it',
        is_error: false,
        num_turns: 2,
        total_cost_usd: 0.25,
        usage: { input_tokens: 5, output_tokens: 100, cache_creation_input_tokens: 400 },
      },
    ]),
  );
  return buildRoutine(
    path.join(tmp, `${name}.md`),
    `---\ncwd: ${cwd}\n${frontmatter}\n---\nFix it.`,
  );
}

async function waitForStatus(routine: string, id: RunId, status: RunRecord['status']) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const record = readRunRecord(routineNameSchema.parse(routine), id);
    if (record?.status === status) return record;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return assert.fail(`${routine} never became ${status}`);
}

test('a run stopped by a usage limit waits for the reset and continues its session', async () => {
  const runId = runIdSchema.parse('20261119T070000Z-wait');
  const finishing = runRoutine(makeLimitedRoutine('limited'), { trigger: 'manual', runId });
  const waiting = await waitForStatus('limited', runId, 'waiting');
  assert.equal(waiting.pid, process.pid);
  assert.equal(waiting.error, null);
  assert.equal(waiting.usageLimit?.limit, 'session');
  assert.equal(checkIsRunning(waiting.routine), true);
  requestWaitAction(waiting, 'continue');

  const finished = await finishing;
  assert.equal(finished.status, 'succeeded');
  assert.equal(finished.resultText, 'Fixed it');
  assert.equal(finished.numTurns, 5);
  assert.equal(finished.costUsd, 0.75);
  assert.deepEqual(finished.tokens, { input: 15, output: 300, cacheWrite: 400, cacheRead: 3000 });
  assert.equal(finished.usageLimit, null);
  const args = fs
    .readFileSync(path.join(tmp, 'limited', 'args.txt'), 'utf8')
    .trim()
    .split('\n');
  assert.equal(args.length, 2);
  assert.match(args[1] ?? '', /after your usage limit reset.* --resume s1$/);
  assert.deepEqual(
    readLogTypes(finished).filter(type => type.startsWith('usage_limit')),
    ['usage_limit_wait', 'usage_limit_end'],
  );
});

test('a run that stops waiting for a usage limit fails with the limit, and the after hook runs', async () => {
  const runId = runIdSchema.parse('20261119T070000Z-stop');
  const finishing = runRoutine(makeLimitedRoutine('limited-stop', 'after: echo after'), {
    trigger: 'manual',
    runId,
  });
  requestWaitAction(await waitForStatus('limited-stop', runId, 'waiting'), 'stop');

  const finished = await finishing;
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, LIMIT_MESSAGE);
  assert.equal(finished.usageLimit, null);
  const log = readLog(finished);
  assert.ok(isMatching({ type: 'usage_limit_end', outcome: 'stopped' }, log.at(-2)));
  assert.ok(isMatching({ type: 'after_hook', exitCode: 0 }, log.at(-1)));
});

test('a routine with onUsageLimit: fail fails at the limit without waiting', async () => {
  const finished = await runRoutine(makeLimitedRoutine('limited-fail', 'onUsageLimit: fail'), {
    trigger: 'manual',
  });
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, LIMIT_MESSAGE);
  assert.equal(readLogTypes(finished).includes('usage_limit_wait'), false);
});

test('a run that used its token budget before a usage limit fails instead of waiting', async () => {
  const finished = await runRoutine(makeLimitedRoutine('limited-tokens', 'maxBudgetTokens: 3k'), {
    trigger: 'manual',
  });
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, 'Reached the budget of 3K tokens');
  assert.equal(readLogTypes(finished).includes('usage_limit_wait'), false);
});

test('a waiting run whose runner is gone is aborted and its wait ends', () => {
  const run = makeFinishedRun('limited-gone', '20261119T070000Z-gone', {
    status: 'waiting',
    endedAt: null,
    pid: spawnSync('true').pid,
    usageLimit: {
      limit: 'session',
      stoppedAt: '2026-11-19T07:06:00Z',
      continuesAt: '2026-11-19T08:11:00Z',
    },
  });
  const [reconciled] = listRuns(run.routine);
  assert.equal(reconciled?.status, 'aborted');
  assert.equal(reconciled.usageLimit, null);
  assert.ok(isMatching([{ type: 'usage_limit_end', outcome: 'stopped' }], readLog(run)));
});

const STREAM_ERROR = 'API Error: Stream idle timeout - partial response received';

// A routine whose claude ends with an error result, and whose resumed session finishes.
function makeErroringRoutine(name: string, result: object, frontmatter: string) {
  const cwd = path.join(tmp, name);
  fs.mkdirSync(cwd, { recursive: true });
  const toLines = (events: unknown[]) => events.map(event => JSON.stringify(event)).join('\n');
  const init = { type: 'system', subtype: 'init', session_id: 's1' };
  fs.writeFileSync(
    path.join(cwd, 'limited.jsonl'),
    toLines([
      init,
      { type: 'result', is_error: true, num_turns: 3, total_cost_usd: 0.5, ...result },
    ]),
  );
  fs.writeFileSync(
    path.join(cwd, 'resumed.jsonl'),
    toLines([
      init,
      { type: 'result', result: 'Fixed it', is_error: false, num_turns: 2, total_cost_usd: 0.25 },
    ]),
  );
  return buildRoutine(
    path.join(tmp, `${name}.md`),
    `---\ncwd: ${cwd}\n${frontmatter}\n---\nFix it.`,
  );
}

test('a run that stops with an error waits and continues its session in the next attempt', async () => {
  const runId = runIdSchema.parse('20261122T020000Z-rtry');
  const finishing = runRoutine(
    makeErroringRoutine('retried', { result: STREAM_ERROR }, 'retries: 2'),
    { trigger: 'schedule', runId },
  );
  const retrying = await waitForStatus('retried', runId, 'retrying');
  assert.equal(retrying.pid, process.pid);
  assert.equal(retrying.error, null);
  assert.equal(checkIsRunning(retrying.routine), true);
  const { retry } = retrying;
  assert.equal(retry?.attempt, 2);
  assert.equal(retry.attempts, 3);
  assert.equal(retry.error, STREAM_ERROR);
  assert.equal(retry.continuesSession, true);
  assert.equal(Date.parse(retry.continuesAt) - Date.parse(retry.stoppedAt), 5 * 60_000);
  requestWaitAction(retrying, 'continue');

  const finished = await finishing;
  assert.equal(finished.status, 'succeeded');
  assert.equal(finished.resultText, 'Fixed it');
  assert.equal(finished.numTurns, 5);
  assert.equal(finished.costUsd, 0.75);
  assert.equal(finished.retry?.attempt, 2);
  const args = fs
    .readFileSync(path.join(tmp, 'retried', 'args.txt'), 'utf8')
    .trim()
    .split('\n');
  assert.equal(args.length, 2);
  assert.match(args[1] ?? '', /after an error stopped your last attempt.* --resume s1$/);
  assert.deepEqual(
    readLogTypes(finished).filter(type => type.startsWith('retry')),
    ['retry_wait', 'retry_end'],
  );
});

test('an attempt without a session to continue starts over with the before hook', async () => {
  const runId = runIdSchema.parse('20261122T020000Z-over');
  const cwd = path.join(tmp, 'started-over');
  fs.mkdirSync(cwd, { recursive: true });
  const finishing = runRoutine(
    makeRoutine(
      'started-over',
      `cwd: ${cwd}\nretries: 1\nbefore: echo before >> hooks.txt\ncommand: if [ -f tried ]; then echo done; else touch tried; exit 3; fi`,
    ),
    { trigger: 'manual', runId },
  );
  const retrying = await waitForStatus('started-over', runId, 'retrying');
  assert.equal(retrying.retry?.continuesSession, false);
  assert.equal(retrying.retry.error, 'exit code 3');
  requestWaitAction(retrying, 'continue');

  const finished = await finishing;
  assert.equal(finished.status, 'succeeded');
  assert.equal(fs.readFileSync(path.join(cwd, 'hooks.txt'), 'utf8'), 'before\nbefore\n');
  const { items } = buildRunTranscript(finished.agent, readRunEvents(finished));
  assert.deepEqual(
    items.map(item => item.kind),
    ['hook', 'retry', 'hook', 'text'],
  );
});

test('a run that stops retrying fails with the error of its last attempt, and the after hook runs', async () => {
  const runId = runIdSchema.parse('20261122T020000Z-stop');
  const finishing = runRoutine(
    makeRoutine('retry-stop', 'retries: 2\ncommand: exit 3\nafter: echo after'),
    { trigger: 'manual', runId },
  );
  requestWaitAction(await waitForStatus('retry-stop', runId, 'retrying'), 'stop');

  const finished = await finishing;
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, 'exit code 3');
  assert.equal(finished.retry, null);
  const log = readLog(finished);
  assert.ok(isMatching({ type: 'retry_end', outcome: 'stopped' }, log.at(-2)));
  assert.ok(isMatching({ type: 'after_hook', exitCode: 0 }, log.at(-1)));
});

test('a run stopped by its budget fails without a retry', async () => {
  const finished = await runRoutine(
    makeErroringRoutine(
      'over-budget',
      { subtype: 'error_max_budget_usd', result: 'Reached the budget' },
      'retries: 2\nmaxBudgetUsd: 1',
    ),
    { trigger: 'manual' },
  );
  assert.equal(finished.status, 'failed');
  assert.equal(readLogTypes(finished).includes('retry_wait'), false);
});

test('the next attempt gets only what is left of the budget', async () => {
  const runId = runIdSchema.parse('20261122T020000Z-bdgt');
  const finishing = runRoutine(
    makeErroringRoutine('budget-left', { result: STREAM_ERROR }, 'retries: 2\nmaxBudgetUsd: 2'),
    { trigger: 'manual', runId },
  );
  requestWaitAction(await waitForStatus('budget-left', runId, 'retrying'), 'continue');

  assert.equal((await finishing).status, 'succeeded');
  const args = fs
    .readFileSync(path.join(tmp, 'budget-left', 'args.txt'), 'utf8')
    .trim()
    .split('\n');
  assert.match(args[0] ?? '', /--max-budget-usd 2$/);
  assert.match(args[1] ?? '', /--max-budget-usd 1\.5 --resume s1$/);
});

test('a run that spent its whole budget fails without a retry', async () => {
  const finished = await runRoutine(
    makeErroringRoutine('budget-spent', { result: STREAM_ERROR }, 'retries: 2\nmaxBudgetUsd: 0.5'),
    { trigger: 'manual' },
  );
  assert.equal(finished.status, 'failed');
  assert.equal(readLogTypes(finished).includes('retry_wait'), false);
});

test('a run that spent its whole token budget fails without a retry', async () => {
  const finished = await runRoutine(
    makeErroringRoutine(
      'tokens-spent',
      { result: STREAM_ERROR, usage: { input_tokens: 10, cache_read_input_tokens: 990 } },
      'retries: 2\nmaxBudgetTokens: 1k',
    ),
    { trigger: 'manual' },
  );
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, STREAM_ERROR);
  assert.equal(readLogTypes(finished).includes('retry_wait'), false);
});

const CLAUDE_INIT = { type: 'system', subtype: 'init', session_id: 's1' };

function claudeCall(id: string, usage: object) {
  return { type: 'assistant', message: { id, content: [{ type: 'text', text: id }], usage } };
}

// A routine whose claude makes the calls, then waits to be stopped when stopped is given.
function makeCallingRoutine(
  name: string,
  calls: unknown[],
  stopped: unknown[] | null,
  frontmatter: string,
) {
  const cwd = path.join(tmp, name);
  fs.mkdirSync(cwd, { recursive: true });
  const toLines = (events: unknown[]) => events.map(event => `${JSON.stringify(event)}\n`).join('');
  fs.writeFileSync(path.join(cwd, 'calls.jsonl'), toLines(calls));
  if (stopped !== null) fs.writeFileSync(path.join(cwd, 'stopped.jsonl'), toLines(stopped));
  return buildRoutine(
    path.join(tmp, `${name}.md`),
    `---\ncwd: ${cwd}\n${frontmatter}\n---\nFix it.`,
  );
}

test('a run that reaches its token budget is stopped and fails without a retry', async () => {
  const started = Date.now();
  const finished = await runRoutine(
    makeCallingRoutine(
      'over-tokens',
      [
        CLAUDE_INIT,
        claudeCall('m1', { input_tokens: 10, cache_read_input_tokens: 400 }),
        claudeCall('m1', { input_tokens: 10, cache_read_input_tokens: 400 }),
        claudeCall('m2', { output_tokens: 5, cache_read_input_tokens: 700 }),
      ],
      [],
      'retries: 2\nmaxBudgetTokens: 1k',
    ),
    { trigger: 'manual' },
  );
  assert.ok(Date.now() - started < 10_000);
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, 'Reached the budget of 1K tokens');
  assert.deepEqual(finished.tokens, { input: 10, output: 5, cacheWrite: 0, cacheRead: 1100 });
  assert.equal(readLogTypes(finished).includes('retry_wait'), false);
});

test('a stopped run counts the call its result left out', async () => {
  const finished = await runRoutine(
    makeCallingRoutine(
      'over-tokens-result',
      [CLAUDE_INIT, claudeCall('m1', { cache_read_input_tokens: 2_000_000 })],
      [
        {
          type: 'result',
          subtype: 'error_during_execution',
          is_error: true,
          usage: { input_tokens: 4, output_tokens: 300, cache_read_input_tokens: 1_500_000 },
        },
      ],
      'maxBudgetTokens: 2M',
    ),
    { trigger: 'manual' },
  );
  assert.equal(finished.status, 'failed');
  assert.equal(finished.error, 'Reached the budget of 2M tokens');
  assert.deepEqual(finished.tokens, { input: 4, output: 300, cacheWrite: 0, cacheRead: 2_000_000 });
});

test('a run counts each call once, however many events report it', async () => {
  const finished = await runRoutine(
    makeCallingRoutine(
      'tokens-once',
      [
        CLAUDE_INIT,
        claudeCall('m1', { input_tokens: 600 }),
        claudeCall('m1', { input_tokens: 600 }),
        { type: 'result', result: 'Done', is_error: false, usage: { input_tokens: 600 } },
      ],
      null,
      'maxBudgetTokens: 1000',
    ),
    { trigger: 'manual' },
  );
  assert.equal(finished.status, 'succeeded');
  assert.equal(finished.resultText, 'Done');
});

test('a routine without retries fails at the first error', async () => {
  const finished = await runRoutine(makeRoutine('no-retries', 'command: exit 3'), {
    trigger: 'manual',
  });
  assert.equal(finished.status, 'failed');
  assert.equal(readLogTypes(finished).includes('retry_wait'), false);
});

test('a retrying run whose runner is gone is aborted without the attempt it waited for', () => {
  const run = makeFinishedRun('retry-gone', '20261122T020000Z-gone', {
    status: 'retrying',
    endedAt: null,
    pid: spawnSync('true').pid,
    retry: {
      attempt: 2,
      attempts: 3,
      error: STREAM_ERROR,
      stoppedAt: '2026-11-22T02:06:00Z',
      continuesAt: '2026-11-22T02:11:00Z',
      continuesSession: true,
    },
  });
  const [reconciled] = listRuns(run.routine);
  assert.equal(reconciled?.status, 'aborted');
  assert.equal(reconciled.retry, null);
  assert.ok(isMatching([{ type: 'retry_end', outcome: 'stopped' }], readLog(run)));
});

function makeGitRepo(name: string): string {
  const repo = path.join(tmp, 'repos', name);
  fs.mkdirSync(repo, { recursive: true });
  fs.writeFileSync(path.join(repo, 'README.md'), 'Hello\n');
  for (const args of [
    ['init', '--quiet', '--initial-branch=main'],
    ['add', '.'],
    ['commit', '--quiet', '-m', 'Start'],
  ]) {
    spawnSync('git', args, { cwd: repo });
  }
  return repo;
}

test('a routine with worktree: true works on its own branch, with its after hook, and leaves its cwd alone', async () => {
  const repo = makeGitRepo('fix');
  const record = await runRoutine(
    makeRoutine(
      'worktree-fix',
      `cwd: ${repo}\ncommand: echo fixed > fix.txt && git add fix.txt && git commit --quiet -m Fix\nworktree: true\n${makeRecordingHook('worktree')}`,
    ),
    { trigger: 'manual' },
  );
  assert.equal(record.status, 'succeeded');
  const { worktree } = record;
  assert.equal(worktree?.state, 'present');
  assert.equal(worktree.branch, `kombinat/worktree-fix-${record.id}`);
  assert.deepEqual(worktree.changes?.files, [{ path: 'fix.txt', added: 1, removed: 0 }]);
  assert.equal(fs.readFileSync(path.join(worktree.cwd, 'fix.txt'), 'utf8'), 'fixed\n');
  assert.ok(!fs.existsSync(path.join(repo, 'fix.txt')));
  const hook = readHookCapture('worktree');
  assert.equal(hook.cwd, worktree.cwd);
  assert.deepEqual(hook.stdin, record);
});

test('a worktree run that changed nothing leaves no worktree or branch behind', async () => {
  const repo = makeGitRepo('quiet');
  const record = await runRoutine(makeRoutine('worktree-quiet', `cwd: ${repo}\nworktree: true`), {
    trigger: 'manual',
  });
  assert.equal(record.status, 'succeeded');
  assert.equal(record.worktree?.state, 'discarded');
  assert.ok(!fs.existsSync(record.worktree.path));
  const branches = spawnSync('git', ['branch', '--list', 'kombinat/*'], {
    cwd: repo,
    encoding: 'utf8',
  });
  assert.equal(branches.stdout, '');
});

test('a worktree run outside a git repository fails before its agent starts', async () => {
  const folder = path.join(tmp, 'plain-folder');
  fs.mkdirSync(folder, { recursive: true });
  const record = await runRoutine(
    makeRoutine('worktree-no-repo', `cwd: ${folder}\ncommand: touch started.txt\nworktree: true`),
    { trigger: 'manual' },
  );
  assert.equal(record.status, 'failed');
  assert.match(record.error ?? '', /worktree: true needs a git repository/);
  assert.equal(record.worktree, null);
  assert.ok(!fs.existsSync(path.join(folder, 'started.txt')));
});
