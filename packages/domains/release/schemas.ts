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
