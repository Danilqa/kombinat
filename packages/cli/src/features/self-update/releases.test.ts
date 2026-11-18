import assert from 'node:assert/strict';
import { test } from 'node:test';

import { releaseVersionSchema } from 'domains/release/ids';
import type { Release } from 'domains/release/types';

import { createReleaseCache, parseGithubReleases } from './releases';

const makeGithubRelease = (tag: string, overrides: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/Danilqa/kombinat/releases/tag/${tag}`,
  body: [
    '- Added a thing (#90)',
    '- `kombinat run <name>` takes a `--trigger`',
    '',
    '<img src="https://github.com/user-attachments/assets/1" alt="The thing" width="100%" />',
    '',
    '**Full Changelog**: https://github.com/Danilqa/kombinat/compare/v0.5.1...v0.6.0',
  ].join('\n'),
  published_at: '2026-11-18T10:00:00Z',
  draft: false,
  prerelease: false,
  ...overrides,
});

const makeRelease = (version: string): Release => ({
  version: releaseVersionSchema.parse(version),
  notes: '',
  url: '',
  publishedAt: '2026-11-18T10:00:00Z',
});

test('github releases become versions without the v, with notes but no html lines or compare link', () => {
  assert.deepEqual(parseGithubReleases([makeGithubRelease('v0.6.0')]), [
    {
      version: '0.6.0',
      notes: '- Added a thing (#90)\n- `kombinat run <name>` takes a `--trigger`',
      url: 'https://github.com/Danilqa/kombinat/releases/tag/v0.6.0',
      publishedAt: '2026-11-18T10:00:00Z',
    },
  ]);
});

test('drafts, prereleases and tags that are not versions are left out', () => {
  const releases = parseGithubReleases([
    makeGithubRelease('v0.7.0', { draft: true, published_at: null }),
    makeGithubRelease('v0.7.0-beta.1', { prerelease: true }),
    makeGithubRelease('nightly'),
    makeGithubRelease('v0.6.0', { body: null }),
  ]);
  assert.deepEqual(
    releases.map(release => [release.version, release.notes]),
    [['0.6.0', '']],
  );
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
