import type { z } from 'zod';

import type { githubReleaseSchema, releaseSchema, releaseUpdateSchema } from './schemas';

export type Release = z.infer<typeof releaseSchema>;

export type ReleaseUpdate = z.infer<typeof releaseUpdateSchema>;

export type GithubRelease = z.infer<typeof githubReleaseSchema>;

export interface ReleaseImage {
  src: string;
  alt: string;
  width: number | null;
}

export interface ChangelogRelease extends Release {
  images: ReleaseImage[];
}
