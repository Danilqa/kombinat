import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkIsDiskLow, formatBytes, formatCpuLoad, formatDiskSpace } from './utils';

test('bytes read in the largest decimal unit, with a decimal only below ten', () => {
  assert.equal(formatBytes(1_834_000_000), '1.8 GB');
  assert.equal(formatBytes(494_380_000_000), '494 GB');
  assert.equal(formatBytes(2_000_000_000_000), '2 TB');
  assert.equal(formatBytes(512_000_000), '512 MB');
  assert.equal(formatBytes(4_000_000_000_000_000), '4,000 TB');
  assert.equal(formatBytes(0), '0 B');
});

test('disk space reads as free of total', () => {
  assert.equal(
    formatDiskSpace({ freeBytes: 182_400_000_000, totalBytes: 494_380_000_000 }),
    '182 GB free of 494 GB',
  );
});

test('a disk with less than 10 GB free is low', () => {
  assert.equal(checkIsDiskLow({ freeBytes: 1_834_000_000, totalBytes: 494_380_000_000 }), true);
  assert.equal(checkIsDiskLow({ freeBytes: 182_400_000_000, totalBytes: 494_380_000_000 }), false);
});

test('the cpu load reads as a whole percentage, or a dash before the first sample', () => {
  assert.equal(formatCpuLoad(0.234), '23%');
  assert.equal(formatCpuLoad(null), '-');
});
