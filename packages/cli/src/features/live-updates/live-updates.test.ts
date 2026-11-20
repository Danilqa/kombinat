import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kombinat-test-'));
const routinesDir = path.join(tmp, 'routines');
process.env['KOMBINAT_ROUTINES_DIR'] = routinesDir;
process.env['KOMBINAT_STATE_DIR'] = path.join(tmp, 'state');
fs.mkdirSync(routinesDir);

const { checkIsWatchedStateFile, trackSchedule } = await import('./live-updates');
const { tick } = await import('../../domains/scheduler/tick');

test('run records, queued webhooks, webhook calls, read runs, one-time runs and the scheduler state are changes clients see', () => {
  assert.equal(checkIsWatchedStateFile('runs/triage/20261006T115000Z-ab12.json'), true);
  assert.equal(
    checkIsWatchedStateFile('queue/triage/000001791000000-20261006T115000Z-ab12.payload'),
    true,
  );
  assert.equal(checkIsWatchedStateFile('webhooks/triage/001791000000000.json'), true);
  assert.equal(checkIsWatchedStateFile('inbox.json'), true);
  assert.equal(checkIsWatchedStateFile('one-time-runs.json'), true);
  assert.equal(checkIsWatchedStateFile('scheduler.json'), true);
});

test('run logs, half-written files and the daemon log are not', () => {
  assert.equal(checkIsWatchedStateFile('runs/triage/20261006T115000Z-ab12.jsonl'), false);
  assert.equal(checkIsWatchedStateFile('runs/triage/20261006T115000Z-ab12.json.tmp'), false);
  assert.equal(checkIsWatchedStateFile('scheduler.json.tmp'), false);
  assert.equal(checkIsWatchedStateFile('daemon.log'), false);
});

test('a tick changes the schedule only when it records a skip, not by its own time', () => {
  fs.writeFileSync(
    path.join(routinesDir, 'paused.md'),
    '---\nname: paused\ncwd: /tmp\nschedule: "* * * * *"\nenabled: false\n---\nHello',
  );
  tick(new Date('2026-09-30T10:00:10'));
  const checkHasScheduleChanged = trackSchedule();

  tick(new Date('2026-09-30T10:00:40'));
  assert.equal(checkHasScheduleChanged(), false);

  tick(new Date('2026-09-30T10:01:10'));
  assert.equal(checkHasScheduleChanged(), true);
});
