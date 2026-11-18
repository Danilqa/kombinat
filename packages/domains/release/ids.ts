import { z } from 'zod';

export const releaseVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/)
  .brand<'ReleaseVersion'>();

export type ReleaseVersion = z.infer<typeof releaseVersionSchema>;
