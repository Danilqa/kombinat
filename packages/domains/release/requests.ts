import type { Api } from 'utils/api';

import { GITHUB_RELEASES_PATH } from './constants';
import type { ReleaseVersion } from './ids';
import { githubReleasesSchema, releaseUpdateSchema, skippedReleaseSchema } from './schemas';
import type { ChangelogRelease, ReleaseUpdate } from './types';
import { parseChangelog } from './utils';

export async function getReleaseUpdate(api: Api): Promise<ReleaseUpdate> {
  return api.get('/api/releases').json(releaseUpdateSchema);
}

export async function skipRelease(api: Api, version: ReleaseVersion): Promise<void> {
  await api.post(`/api/releases/${version}/skip`).json(skippedReleaseSchema);
}

// Takes an api of https://api.github.com rather than of the daemon.
export async function getChangelog(github: Api): Promise<ChangelogRelease[]> {
  return parseChangelog(
    await github
      .get(GITHUB_RELEASES_PATH, { searchParams: { per_page: 100 } })
      .json(githubReleasesSchema),
  );
}
