import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';
import type { UsageLimitWait } from 'domains/run/types';

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-')));
const stateDir = path.join(tmp, 'state');
process.env['KOMBINAT_STATE_DIR'] = stateDir;
process.env['KOMBINAT_TICK_SECONDS'] = '0.5';

const { writeRunRecord } = await import('./storage');
const { requestWaitAction, waitOutUsageLimit } = await import('./usage-limit');
const { makeRunRecord } = await import('domains/run/mocks');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function writeWaitingRun(name: string) {
  const usageLimit: UsageLimitWait = {
    limit: 'session',
    stoppedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    continuesAt: new Date(Date.now() - 1000).toISOString(),
  };
  const record = makeRunRecord({
    id: runIdSchema.parse(`${name}-1`),
    routine: routineNameSchema.parse(name),
    status: 'waiting',
    pid: process.pid,
    logFile: path.join(tmp, `${name}.jsonl`),
    usageLimit,
  });
  writeRunRecord(record);
  return { record, usageLimit };
}

test(
  'with no scheduler, a run past its reset continues by itself',
  { timeout: 10_000 },
  async () => {
    const { record, usageLimit } = writeWaitingRun('no-scheduler');
    assert.equal(await waitOutUsageLimit(record, usageLimit), 'continued');
  },
);

test('while the scheduler ticks, a run past its reset waits for it to continue', async () => {
  const schedulerFile = path.join(stateDir, 'scheduler.json');
  const ticking = setInterval(() => fs.writeFileSync(schedulerFile, '{}'), 300);
  const { record, usageLimit } = writeWaitingRun('ticking');
  const waiting = waitOutUsageLimit(record, usageLimit);
  assert.equal(await Promise.race([waiting, sleep(3000).then(() => 'pending')]), 'pending');

  requestWaitAction(record, 'continue');
  assert.equal(await waiting, 'continued');
  clearInterval(ticking);
});
