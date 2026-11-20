import type { HttpClient } from 'utils/http';

import { GITHUB_RELEASES_PATH } from './constants';
import type { ReleaseVersion } from './ids';
import { githubReleasesSchema, releaseUpdateSchema, skippedReleaseSchema } from './schemas';
import type { ChangelogRelease, ReleaseUpdate } from './types';
import { parseChangelog } from './utils';

export async function getReleaseUpdate(http: HttpClient): Promise<ReleaseUpdate> {
  return http.request('/api/releases', releaseUpdateSchema);
}

export async function skipRelease(http: HttpClient, version: ReleaseVersion): Promise<void> {
  await http.request(`/api/releases/${version}/skip`, skippedReleaseSchema, { method: 'POST' });
}

// Takes a client of https://api.github.com rather than of the daemon.
export async function getChangelog(github: HttpClient): Promise<ChangelogRelease[]> {
  return parseChangelog(
    await github.request(`${GITHUB_RELEASES_PATH}?per_page=100`, githubReleasesSchema),
  );
}
