import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { routineNameSchema } from 'domains/routine/ids';
import { runIdSchema } from 'domains/run/ids';
import { makeRunRecord } from 'domains/run/mocks';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');

const { writeSettings } = await import('../settings/storage');
const { deleteExpiredRuns } = await import('./retention');
const { getRunsDir, writeRunRecord } = await import('./storage');

const triage = routineNameSchema.parse('triage');
const now = new Date('2026-11-20T09:00:00Z');

function addRun(id: string, startedAt: string): void {
  const logFile = path.join(getRunsDir(triage), `${id}.jsonl`);
  writeRunRecord(
    makeRunRecord({
      id: runIdSchema.parse(id),
      routine: triage,
      status: 'succeeded',
      startedAt,
      logFile,
    }),
  );
  fs.writeFileSync(logFile, '{}\n');
}

test('deletes the record and event log of each expired run once a retention is set', () => {
  addRun('old', '2026-11-01T09:00:00Z');
  addRun('new', '2026-11-19T09:00:00Z');

  assert.deepEqual(deleteExpiredRuns(now), []);
  writeSettings({ runRetentionDays: 7 });
  assert.deepEqual(
    deleteExpiredRuns(now).map(run => run.id),
    ['old'],
  );
  assert.deepEqual(fs.readdirSync(getRunsDir(triage)).sort(), ['new.json', 'new.jsonl']);
});
