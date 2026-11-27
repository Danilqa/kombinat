import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema, type RunId } from 'domains/run/ids';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-')));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { config } = await import('../../config');
const { checkIsRunning, checkIsStarting, startDetachedRun, startDetachedRuns } =
  await import('./launcher');
const { cancelQueuedRuns, readQueuedRuns } = await import('./queued-runs');
const { listRuns, writeRunRecord } = await import('./storage');
const { makeRunRecord } = await import('domains/run/mocks');

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

test('a replying run keeps its routine running until its reply process is gone', () => {
  const routine = routineNameSchema.parse('chat-busy');
  const id = runIdSchema.parse('20261117T090000Z-busy');
  const runsDir = path.join(config.stateDir, 'runs', routine);
  fs.mkdirSync(runsDir, { recursive: true });
  const run = makeRunRecord({
    id,
    routine,
    status: 'succeeded',
    endedAt: '2026-10-06T11:05:00Z',
    logFile: path.join(runsDir, `${id}.jsonl`),
    replyPid: process.pid,
  });
  fs.writeFileSync(run.logFile, '');
  writeRunRecord(run);
  assert.equal(checkIsRunning(run.routine), true);
  writeRunRecord({ ...run, replyPid: spawnSync('true').pid });
  assert.equal(checkIsRunning(run.routine), false);
  assert.equal(listRuns(run.routine)[0]?.replyPid, null);
  assert.deepEqual(
    fs
      .readFileSync(run.logFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line): unknown => JSON.parse(line)),
    [{ type: 'reply_error', error: 'Reply process disappeared' }],
  );
});
