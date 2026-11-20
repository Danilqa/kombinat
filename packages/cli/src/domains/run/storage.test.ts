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

const { getRunsDir, listRunsSince, writeRunRecord } = await import('./storage');

const triage = routineNameSchema.parse('triage');
const since = new Date('2026-11-14T00:00:00Z');

function addRun(id: string, writtenAt: string): void {
  writeRunRecord(
    makeRunRecord({ id: runIdSchema.parse(id), routine: triage, status: 'succeeded' }),
  );
  const writtenAtDate = new Date(writtenAt);
  fs.utimesSync(path.join(getRunsDir(triage), `${id}.json`), writtenAtDate, writtenAtDate);
}

test('lists the runs whose records were written since the date, however old their ids', () => {
  addRun('20261101T090000Z-old1', '2026-11-01T09:10:00Z');
  addRun('20261101T091000Z-queu', '2026-11-18T09:00:00Z');
  addRun('20261119T090000Z-new1', '2026-11-19T09:05:00Z');

  assert.deepEqual(
    listRunsSince(triage, since)
      .map(run => run.id)
      .sort(),
    ['20261101T091000Z-queu', '20261119T090000Z-new1'],
  );
});
