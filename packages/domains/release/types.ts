import type { z } from 'zod';

import type { releaseSchema, releaseUpdateSchema } from './schemas';

export type Release = z.infer<typeof releaseSchema>;

export type ReleaseUpdate = z.infer<typeof releaseUpdateSchema>;
