import path from 'node:path';

import { z } from 'zod';

import { releaseVersionSchema, type ReleaseVersion } from 'domains/release/ids';
import type { Release, ReleaseUpdate } from 'domains/release/types';
import { listNewerReleases } from 'domains/release/utils';
import { createHttpClient } from 'utils/http';

import { config, PACKAGE_NAME } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { findDependencies } from '../../utils/package-manager';

// GitHub allows 60 requests an hour without a token.
const CHECK_INTERVAL_MS = 60 * 60_000;

const github = createHttpClient({ baseUrl: 'https://api.github.com', timeoutMs: 10_000 });

const githubReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string(),
  body: z.string().nullable(),
  published_at: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});

const skippedReleaseFileSchema = z.object({ skippedVersion: releaseVersionSchema });

const FULL_CHANGELOG_LINE = /^\*\*Full Changelog\*\*.*$/m;

// The dashboard renders markdown without HTML, so a screenshot's <img> would show as text.
// Only whole lines go, since inline text such as `kombinat run <name>` looks like a tag too.
const HTML_LINE = /^\s*<[^>]+>\s*$/gm;

const skippedReleaseFile = () => path.join(config.stateDir, 'releases.json');

export function parseGithubReleases(body: unknown): Release[] {
  return z
    .array(githubReleaseSchema)
    .parse(body)
    .flatMap(release => {
      const version = releaseVersionSchema.safeParse(release.tag_name.replace(/^v/, ''));
      const { draft, prerelease, published_at: publishedAt } = release;
      if (draft || prerelease || publishedAt === null || !version.success) return [];
      return {
        version: version.data,
        notes: (release.body ?? '').replace(FULL_CHANGELOG_LINE, '').replace(HTML_LINE, '').trim(),
        url: release.html_url,
        publishedAt,
      };
    });
}

async function fetchReleases(): Promise<Release[]> {
  return parseGithubReleases(
    await github.request('/repos/Danilqa/kombinat/releases?per_page=30', z.unknown()),
  );
}

// A failed check keeps the releases of the last one and waits as long as a successful one.
// Only the first check waits for GitHub, so a slow network never holds up a dashboard's refresh.
export function createReleaseCache(
  load: () => Promise<Release[]>,
  now: () => number = Date.now,
): () => Promise<Release[]> {
  let checkedAt = -Infinity;
  let releases = Promise.resolve<Release[]>([]);
  return () => {
    if (now() - checkedAt < CHECK_INTERVAL_MS) return releases;
    const isFirstCheck = checkedAt === -Infinity;
    checkedAt = now();
    const previous = releases;
    releases = load().catch(() => previous);
    return isFirstCheck ? releases : previous;
  };
}

const listReleases = createReleaseCache(fetchReleases);

function getUpdateCommand(version: ReleaseVersion): string | null {
  const dependencies = findDependencies(config.projectRoot);
  if (!config.installedInProject || dependencies === null) return null;
  const { manager } = dependencies;
  return `${manager.command} ${manager.add} ${manager.exact} ${PACKAGE_NAME}@${version}`;
}

// A checkout updates with git pull, so only an installed package looks for releases.
export async function getReleaseUpdate(): Promise<ReleaseUpdate> {
  const installedVersion = releaseVersionSchema.safeParse(config.version).data ?? null;
  const releases =
    installedVersion === null || config.fromSource
      ? []
      : listNewerReleases(await listReleases(), installedVersion);
  const [latest] = releases;
  return {
    installedVersion,
    releases,
    skippedVersion:
      readJsonFile(skippedReleaseFile(), skippedReleaseFileSchema)?.skippedVersion ?? null,
    updateCommand: latest === undefined ? null : getUpdateCommand(latest.version),
  };
}

export function skipRelease(version: ReleaseVersion): void {
  writeJsonFile(skippedReleaseFile(), { skippedVersion: version });
}
