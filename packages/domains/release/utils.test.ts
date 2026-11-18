import assert from 'node:assert/strict';
import { test } from 'node:test';

import { releaseVersionSchema } from './ids';
import type { Release, ReleaseUpdate } from './types';
import { getOfferedRelease, listNewerReleases } from './utils';

const version = (value: string) => releaseVersionSchema.parse(value);

const makeRelease = (value: string): Release => ({
  version: version(value),
  notes: `- Notes of ${value}`,
  url: `https://github.com/Danilqa/kombinat/releases/tag/v${value}`,
  publishedAt: '2026-11-16T17:56:28Z',
});

const makeUpdate = (overrides: Partial<ReleaseUpdate>): ReleaseUpdate => ({
  installedVersion: version('0.5.1'),
  releases: [makeRelease('0.6.0')],
  skippedVersion: null,
  updateCommand: null,
  ...overrides,
});

test('newer releases come newest first, compared by number rather than as text', () => {
  const releases = ['0.9.0', '0.10.0', '0.5.1', '0.4.0', '1.0.0', '0.5.2'].map(makeRelease);
  assert.deepEqual(
    listNewerReleases(releases, version('0.5.1')).map(release => release.version),
    ['1.0.0', '0.10.0', '0.9.0', '0.5.2'],
  );
});

test('an install newer than every release, such as a checkout of main, has nothing to update', () => {
  assert.deepEqual(listNewerReleases([makeRelease('0.5.1')], version('0.6.0')), []);
});

test('the latest release is offered until it is skipped, and a newer one is offered again', () => {
  assert.equal(getOfferedRelease(makeUpdate({}))?.version, '0.6.0');
  assert.equal(getOfferedRelease(makeUpdate({ skippedVersion: version('0.6.0') })), null);
  const releases = [makeRelease('0.6.1'), makeRelease('0.6.0')];
  assert.equal(
    getOfferedRelease(makeUpdate({ releases, skippedVersion: version('0.6.0') }))?.version,
    '0.6.1',
  );
  assert.equal(getOfferedRelease(makeUpdate({ releases: [] })), null);
});
