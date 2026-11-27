import path from 'node:path';

import { z } from 'zod';

import { GITHUB_RELEASES_PATH } from 'domains/release/constants';
import { releaseVersionSchema, type ReleaseVersion } from 'domains/release/ids';
import type { Release, ReleaseUpdate } from 'domains/release/types';
import { listNewerReleases, parseGithubReleases } from 'domains/release/utils';
import { createApi } from 'utils/api';

import { config, PACKAGE_NAME } from '../../config';
import { readJsonFile, writeJsonFile } from '../../utils/json';
import { findDependencies } from '../../utils/package-manager';

// GitHub allows 60 requests an hour without a token.
const CHECK_INTERVAL_MS = 60 * 60_000;

const github = createApi({ baseUrl: 'https://api.github.com', timeoutMs: 10_000 });

const skippedReleaseFileSchema = z.object({ skippedVersion: releaseVersionSchema });

const skippedReleaseFile = () => path.join(config.stateDir, 'releases.json');

async function fetchReleases(): Promise<Release[]> {
  return parseGithubReleases(
    await github.get(GITHUB_RELEASES_PATH, { searchParams: { per_page: 30 } }).json(),
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
