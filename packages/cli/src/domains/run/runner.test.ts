import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

import { isMatching } from 'ts-pattern';
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
const fakeClaude = path.join(tmp, 'fake-claude');
fs.writeFileSync(
  fakeClaude,
  `#!/bin/sh
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

const { config } = await import('../../config');
const { buildRoutine } = await import('../routine/utils');
const { appendLogEvent } = await import('./event-log');
const { writePayload, writePrompt } = await import('./payload');
const { checkIsRunning, checkIsStarting, replyToRun, runRoutine, startDetachedRun } =
  await import('./runner');
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
      { type: 'result', result: LIMIT_MESSAGE, is_error: true, num_turns: 3, total_cost_usd: 0.5 },
    ]),
  );
  fs.writeFileSync(
    path.join(cwd, 'resumed.jsonl'),
    toLines([
      { type: 'system', subtype: 'init', session_id: 's1' },
      { type: 'result', result: 'Fixed it', is_error: false, num_turns: 2, total_cost_usd: 0.25 },
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
