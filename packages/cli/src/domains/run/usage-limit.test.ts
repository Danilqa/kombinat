import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { isMatching } from 'ts-pattern';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';
import type { RunRecord, RunStatus } from 'domains/run/types';
import type { UsageLimitOutcome } from 'domains/transcript/types';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-')));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');
process.env['KOMBINAT_MAX_CONCURRENT'] = '2';

const { writeRunRecord } = await import('./storage');
const { requestWaitAction, waitOutUsageLimit } = await import('./usage-limit');
const { makeRunRecord } = await import('domains/run/mocks');

const SLOT_CHECKS_MS = 3000;

function writeRun(name: string, status: RunStatus): RunRecord {
  const record = makeRunRecord({
    id: runIdSchema.parse(`${name}-1`),
    routine: routineNameSchema.parse(name),
    status,
    pid: process.pid,
    logFile: path.join(tmp, `${name}.jsonl`),
    usageLimit: isMatching('waiting', status)
      ? {
          limit: 'session',
          stoppedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
          continuesAt: new Date(Date.now() - 1000).toISOString(),
        }
      : null,
  });
  writeRunRecord(record);
  return record;
}

// Resumes a run the way the runner does: its record turns running as the agent starts again.
async function resume(record: RunRecord): Promise<UsageLimitOutcome> {
  const { usageLimit } = record;
  assert.ok(usageLimit);
  const outcome = await waitOutUsageLimit(record, usageLimit);
  writeRunRecord({ ...record, status: 'running', usageLimit: null });
  return outcome;
}

test('runs that reset together continue only as slots free up', async () => {
  const continued: string[] = [];
  const waiting = ['reset-a', 'reset-b', 'reset-c'].map(name => writeRun(name, 'waiting'));
  const resuming = waiting.map(record =>
    resume(record).then(outcome => {
      continued.push(record.routine);
      return outcome;
    }),
  );
  await new Promise(resolve => setTimeout(resolve, SLOT_CHECKS_MS));
  assert.equal(continued.length, 2);

  const [first] = continued;
  const finished = waiting.find(record => record.routine === first);
  assert.ok(finished);
  writeRunRecord({ ...finished, status: 'succeeded', endedAt: new Date().toISOString() });
  assert.deepEqual(await Promise.all(resuming), ['continued', 'continued', 'continued']);
  for (const record of waiting) {
    writeRunRecord({ ...record, status: 'succeeded', endedAt: new Date().toISOString() });
  }
});

test('Continue now continues a run while every slot is taken', async () => {
  writeRun('busy-a', 'running');
  writeRun('busy-b', 'running');
  const waiting = writeRun('pressed', 'waiting');
  const resuming = resume(waiting);
  requestWaitAction(waiting, 'continue');
  assert.equal(await resuming, 'continued');
});
