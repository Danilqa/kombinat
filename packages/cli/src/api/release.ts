import { releaseVersionSchema } from 'domains/release/ids';

import { getReleaseUpdate, skipRelease } from '../domains/release/releases';
import { fail, ok } from './response';
import type { ApiResponse } from './response';

export async function getReleases(): Promise<ApiResponse> {
  return ok(await getReleaseUpdate());
}

export function skipReleaseVersion(version: string): ApiResponse {
  const parsed = releaseVersionSchema.safeParse(version);
  if (!parsed.success) return fail(400, `${version} is not a release version`);
  skipRelease(parsed.data);
  return ok({ ok: true });
}
