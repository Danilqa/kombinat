import assert from 'node:assert/strict';
import { test } from 'node:test';

import { releaseVersionSchema } from './ids';
import type { GithubRelease, Release, ReleaseUpdate } from './types';
import {
  getOfferedRelease,
  linkPullRequests,
  listNewerReleases,
  listReleaseImages,
  parseChangelog,
  parseGithubReleases,
} from './utils';

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

const makeGithubRelease = (tag: string, overrides: Partial<GithubRelease> = {}): GithubRelease => ({
  tag_name: tag,
  html_url: `https://github.com/Danilqa/kombinat/releases/tag/${tag}`,
  body: [
    '- Added a thing (#90)',
    '- `kombinat run <name>` takes a `--trigger`',
    '',
    '<img src="https://github.com/user-attachments/assets/1" alt="The thing" width="100%" />',
    '<img src="https://github.com/user-attachments/assets/2" alt="On a phone" width="300" /> <img src="https://github.com/user-attachments/assets/3" alt="Its menu" width="300" />',
    '',
    '**Full Changelog**: https://github.com/Danilqa/kombinat/compare/v0.5.1...v0.6.0',
  ].join('\n'),
  published_at: '2026-11-18T10:00:00Z',
  draft: false,
  prerelease: false,
  ...overrides,
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

test('images keep their order and alt text, with a width only when it is in pixels', () => {
  assert.deepEqual(listReleaseImages(makeGithubRelease('v0.6.0').body), [
    { src: 'https://github.com/user-attachments/assets/1', alt: 'The thing', width: null },
    { src: 'https://github.com/user-attachments/assets/2', alt: 'On a phone', width: 300 },
    { src: 'https://github.com/user-attachments/assets/3', alt: 'Its menu', width: 300 },
  ]);
  assert.deepEqual(listReleaseImages('<img src="javascript:alert(1)" alt="x" />'), []);
  assert.deepEqual(listReleaseImages(null), []);
});

test('pull request numbers link to GitHub, except in code, links and urls', () => {
  assert.equal(
    linkPullRequests('- Search (#68)\n- Linux (#57, #54)'),
    '- Search ([#68](https://github.com/Danilqa/kombinat/pull/68))\n- Linux ([#57](https://github.com/Danilqa/kombinat/pull/57), [#54](https://github.com/Danilqa/kombinat/pull/54))',
  );
  const untouched = '`exit #1` and [#2](https://example.com) and https://example.com/a#3 and a#4';
  assert.equal(linkPullRequests(untouched), untouched);
});

test('the changelog lists every release newest first, with linked notes and images', () => {
  const changelog = parseChangelog([
    makeGithubRelease('v0.1.2', { body: '- Fixed a tap (#18)' }),
    makeGithubRelease('v0.10.0', { draft: true }),
    makeGithubRelease('v0.1.10'),
  ]);
  assert.deepEqual(
    changelog.map(release => release.version),
    ['0.1.10', '0.1.2'],
  );
  assert.equal(changelog[0]?.images.length, 3);
  assert.deepEqual(changelog[1], {
    version: '0.1.2',
    notes: '- Fixed a tap ([#18](https://github.com/Danilqa/kombinat/pull/18))',
    url: 'https://github.com/Danilqa/kombinat/releases/tag/v0.1.2',
    publishedAt: '2026-11-18T10:00:00Z',
    images: [],
  });
});
