import type { z } from 'zod';

import type { daemonStatusSchema } from './schemas';

export type DaemonStatus = z.infer<typeof daemonStatusSchema>;

export type DaemonHealth = 'healthy' | 'stale' | 'unreachable';
