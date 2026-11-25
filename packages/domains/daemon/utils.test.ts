import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accountNameSchema } from '../agent/ids';
import type { DaemonStatus, PlanUsage } from './types';

import {
  checkIsDiskLow,
  checkIsUsageLow,
  formatBytes,
  formatCpuLoad,
  formatDiskSpace,
  formatUsageLeft,
  getAccountLimits,
  getCurrentUsageLimits,
  getMostUsedLimit,
} from './utils';

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

const NOW = Date.parse('2026-11-18T12:00:00Z');

test('a usage limit past its reset is left out, since its new usage is unknown', () => {
  const limits = getCurrentUsageLimits(
    {
      updatedAt: '2026-11-18T06:00:00Z',
      session: { usedRatio: 0.9, resetsAt: '2026-11-18T10:00:00Z' },
      week: { usedRatio: 0.4, resetsAt: '2026-11-20T10:00:00Z' },
    },
    NOW,
  );
  assert.deepEqual(limits, [
    { label: 'Weekly limit', usedRatio: 0.4, resetsAt: '2026-11-20T10:00:00Z' },
  ]);
  assert.deepEqual(getCurrentUsageLimits(null, NOW), []);
});

test('the most used limit is the one that runs out first', () => {
  const limits = getCurrentUsageLimits(
    {
      updatedAt: '2026-11-18T11:00:00Z',
      session: { usedRatio: 0.12, resetsAt: '2026-11-18T14:00:00Z' },
      week: { usedRatio: 0.58, resetsAt: '2026-11-20T10:00:00Z' },
    },
    NOW,
  );
  assert.equal(getMostUsedLimit(limits)?.label, 'Weekly limit');
  assert.equal(getMostUsedLimit([]), undefined);
});

test('usage reads as the share left, which is low under 10%', () => {
  assert.equal(formatUsageLeft({ usedRatio: 0.12, resetsAt: '' }), '88%');
  assert.equal(formatUsageLeft({ usedRatio: 1.2, resetsAt: '' }), '0%');
  assert.equal(checkIsUsageLow({ usedRatio: 0.95, resetsAt: '' }), true);
  assert.equal(checkIsUsageLow({ usedRatio: 0.5, resetsAt: '' }), false);
});

const makeStatus = (overrides: Partial<DaemonStatus>): DaemonStatus => ({
  pid: 1,
  startedAt: '2026-10-06T09:00:00Z',
  lastTickAt: '2026-10-06T11:59:50Z',
  routinesDir: '/routines',
  stateDir: '/state',
  claudeBin: 'claude',
  codexBin: 'codex',
  maxConcurrentRuns: 3,
  running: 0,
  timezone: 'UTC',
  now: '2026-10-06T12:00:00Z',
  accounts: [],
  ...overrides,
});

const makeUsage = (usedRatio: number, resetsAt: string): PlanUsage => ({
  updatedAt: '2026-10-06T11:00:00Z',
  session: { usedRatio, resetsAt },
  week: null,
});

test('each account shows its own limits, and one without a current limit is left out', () => {
  const work = accountNameSchema.parse('work');
  const limits = getAccountLimits(
    makeStatus({
      claudeUsage: makeUsage(0.5, '2026-10-06T13:00:00Z'),
      accounts: [
        { name: null, routines: 2, claudeUsage: makeUsage(0.9, '2026-10-06T11:00:00Z') },
        { name: work, routines: 3, claudeUsage: makeUsage(0.4, '2026-10-06T14:00:00Z') },
        { name: accountNameSchema.parse('codex-only'), routines: 1, claudeUsage: null },
      ],
    }),
  );
  assert.deepEqual(
    limits.map(({ account, routines, limits: [limit] }) => [account, routines, limit?.usedRatio]),
    [[work, 3, 0.4]],
  );
});

test('an older daemon without accounts shows the plan of the primary login', () => {
  const limits = getAccountLimits(
    makeStatus({ claudeUsage: makeUsage(0.5, '2026-10-06T13:00:00Z') }),
  );
  assert.deepEqual(
    limits.map(({ account, limits: [limit] }) => [account, limit?.usedRatio]),
    [[null, 0.5]],
  );
});
