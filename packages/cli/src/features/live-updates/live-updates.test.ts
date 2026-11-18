import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkIsWatchedStateFile } from './live-updates';

test('run records, queued webhooks and the scheduler state are changes clients see', () => {
  assert.equal(checkIsWatchedStateFile('runs/triage/20261006T115000Z-ab12.json'), true);
  assert.equal(
    checkIsWatchedStateFile('queue/triage/000001791000000-20261006T115000Z-ab12.payload'),
    true,
  );
  assert.equal(checkIsWatchedStateFile('scheduler.json'), true);
});

test('run logs, half-written files and the daemon log are not', () => {
  assert.equal(checkIsWatchedStateFile('runs/triage/20261006T115000Z-ab12.jsonl'), false);
  assert.equal(checkIsWatchedStateFile('runs/triage/20261006T115000Z-ab12.json.tmp'), false);
  assert.equal(checkIsWatchedStateFile('scheduler.json.tmp'), false);
  assert.equal(checkIsWatchedStateFile('daemon.log'), false);
});
