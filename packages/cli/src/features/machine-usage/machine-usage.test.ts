import assert from 'node:assert/strict';
import os from 'node:os';
import { test } from 'node:test';

import { getCpuLoad, readDiskSpace } from './machine-usage';

test('the cpu load is the busy share of the time between two readings', () => {
  assert.equal(getCpuLoad({ idle: 1000, total: 2000 }, { idle: 1300, total: 3000 }), 0.7);
});

test('the cpu load is unknown when no time passed between two readings', () => {
  assert.equal(getCpuLoad({ idle: 1000, total: 2000 }, { idle: 1000, total: 2000 }), null);
});

test('the disk space of a folder has free bytes within the total', () => {
  const disk = readDiskSpace(os.tmpdir());
  assert.ok(disk !== null);
  assert.ok(disk.totalBytes > 0);
  assert.ok(disk.freeBytes >= 0 && disk.freeBytes <= disk.totalBytes);
});

test('the disk space of a missing folder is unknown', () => {
  assert.equal(readDiskSpace('/no/such/kombinat/folder'), null);
});
