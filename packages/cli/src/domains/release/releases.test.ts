import assert from 'node:assert/strict';
import { test } from 'node:test';

import { releaseVersionSchema } from 'domains/release/ids';
import type { Release } from 'domains/release/types';

import { createReleaseCache } from './releases';

const makeRelease = (version: string): Release => ({
  version: releaseVersionSchema.parse(version),
  notes: '',
  url: '',
  publishedAt: '2026-11-18T10:00:00Z',
});

test('releases are fetched at most once an hour, in the background after the first time', async () => {
  let now = 0;
  const loads: (() => Promise<Release[]>)[] = [
    () => Promise.resolve([makeRelease('0.6.0')]),
    () => Promise.resolve([makeRelease('0.7.0')]),
    () => Promise.reject(new Error('rate limited')),
  ];
  let calls = 0;
  const listReleases = createReleaseCache(
    () => loads[calls++]?.() ?? Promise.resolve([]),
    () => now,
  );

  assert.equal((await listReleases())[0]?.version, '0.6.0');
  now = 59 * 60_000;
  await listReleases();
  assert.equal(calls, 1);
  now = 60 * 60_000;
  assert.equal((await listReleases())[0]?.version, '0.6.0');
  assert.equal(calls, 2);
  assert.equal((await listReleases())[0]?.version, '0.7.0');
  now = 120 * 60_000;
  await listReleases();
  assert.equal(calls, 3);
  assert.equal((await listReleases())[0]?.version, '0.7.0');
});
