import type { HttpClient } from 'utils/http';

import type { ReleaseVersion } from './ids';
import { releaseUpdateSchema, skippedReleaseSchema } from './schemas';
import type { ReleaseUpdate } from './types';

export async function getReleaseUpdate(http: HttpClient): Promise<ReleaseUpdate> {
  return http.request('/api/releases', releaseUpdateSchema);
}

export async function skipRelease(http: HttpClient, version: ReleaseVersion): Promise<void> {
  await http.request(`/api/releases/${version}/skip`, skippedReleaseSchema, { method: 'POST' });
}
