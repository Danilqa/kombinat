import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';
import { makeRunRecord } from 'domains/run/mocks';
import type { RunRecord } from 'domains/run/types';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { getRunsDir, listRuns, listRunsSince, writeRunRecord } = await import('./storage');

function addRun(routine: RoutineName, id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  const record = makeRunRecord({
    id: runIdSchema.parse(id),
    routine,
    status: 'succeeded',
    ...overrides,
  });
  writeRunRecord(record);
  return record;
}

function listSettledRuns(routine: RoutineName): RunRecord[] {
  const longAgo = new Date(Date.now() - 60_000);
  fs.utimesSync(getRunsDir(routine), longAgo, longAgo);
  return listRuns(routine);
}

const listIds = (routine: RoutineName) =>
  listRuns(routine)
    .map(run => run.id)
    .sort();

const listStatuses = (routine: RoutineName) => listRuns(routine).map(run => run.status);

test('lists the runs that started since the date, however old their ids', () => {
  const triage = routineNameSchema.parse('triage');
  addRun(triage, '20261101T090000Z-old1', { startedAt: '2026-11-01T09:00:00Z' });
  addRun(triage, '20261101T091000Z-queu', { startedAt: '2026-11-18T09:00:00Z' });
  addRun(triage, '20261119T090000Z-new1', { startedAt: '2026-11-19T09:00:00Z' });

  assert.deepEqual(
    listRunsSince(triage, new Date('2026-11-14T00:00:00Z'))
      .map(run => run.id)
      .sort(),
    ['20261101T091000Z-queu', '20261119T090000Z-new1'],
  );
});

test('reads the records of a folder again only after the folder changed', () => {
  const digest = routineNameSchema.parse('digest');
  const run = addRun(digest, 'one');
  listSettledRuns(digest);

  const file = path.join(getRunsDir(digest), 'one.json');
  fs.writeFileSync(file, JSON.stringify({ ...run, status: 'failed' }));

  assert.deepEqual(listStatuses(digest), ['succeeded']);
});

test('lists a run that was added after its folder was read', () => {
  const bumps = routineNameSchema.parse('bumps');
  addRun(bumps, 'one');
  listSettledRuns(bumps);

  addRun(bumps, 'two');

  assert.deepEqual(listIds(bumps), ['one', 'two']);
});

test('lists a run with the status it was rewritten to after its folder was read', () => {
  const review = routineNameSchema.parse('review');
  const run = addRun(review, 'one');
  listSettledRuns(review);

  writeRunRecord({ ...run, status: 'failed' });

  assert.deepEqual(listStatuses(review), ['failed']);
});

test('leaves out a run that was deleted after its folder was read', () => {
  const sweep = routineNameSchema.parse('sweep');
  addRun(sweep, 'one');
  addRun(sweep, 'two');
  listSettledRuns(sweep);

  fs.rmSync(path.join(getRunsDir(sweep), 'one.json'));

  assert.deepEqual(listIds(sweep), ['two']);
});

test('aborts a run whose runner disappeared after its folder was read', async () => {
  const audit = routineNameSchema.parse('audit');
  const runner = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  addRun(audit, 'one', { status: 'running', pid: runner.pid ?? null });

  listSettledRuns(audit);
  assert.deepEqual(listStatuses(audit), ['running']);
  runner.kill();
  await once(runner, 'exit');

  assert.deepEqual(listStatuses(audit), ['aborted']);
});
