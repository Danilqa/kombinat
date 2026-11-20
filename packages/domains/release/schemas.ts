import { z } from 'zod';

import { releaseVersionSchema } from './ids';

export const releaseSchema = z.object({
  version: releaseVersionSchema,
  notes: z.string(),
  url: z.string(),
  publishedAt: z.string(),
});

export const releaseUpdateSchema = z.object({
  installedVersion: releaseVersionSchema.nullable(),
  releases: z.array(releaseSchema),
  skippedVersion: releaseVersionSchema.nullable(),
  updateCommand: z.string().nullable(),
});

export const skippedReleaseSchema = z.object({ ok: z.literal(true) });

export const githubReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string(),
  body: z.string().nullable(),
  published_at: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
});

export const githubReleasesSchema = z.array(githubReleaseSchema);
