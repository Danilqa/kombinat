import type { z } from 'zod';

import type { daemonStatusSchema, diskSpaceSchema } from './schemas';

export type DaemonStatus = z.infer<typeof daemonStatusSchema>;

export type DiskSpace = z.infer<typeof diskSpaceSchema>;

export type DaemonHealth = 'healthy' | 'stale' | 'unreachable';
