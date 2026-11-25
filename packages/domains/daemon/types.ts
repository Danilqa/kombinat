import type { z } from 'zod';

import type { AccountName } from '../agent/ids';
import type {
  accountStatusSchema,
  daemonStatusSchema,
  diskSpaceSchema,
  planLimitsSchema,
  planUsageSchema,
  usageLimitSchema,
} from './schemas';

export type AccountStatus = z.infer<typeof accountStatusSchema>;

export type DaemonStatus = z.infer<typeof daemonStatusSchema>;

export type DiskSpace = z.infer<typeof diskSpaceSchema>;

export type UsageLimit = z.infer<typeof usageLimitSchema>;

export type PlanLimits = z.infer<typeof planLimitsSchema>;

export type PlanUsage = z.infer<typeof planUsageSchema>;

export interface CurrentUsageLimit extends UsageLimit {
  label: string;
}

export type DaemonHealth = 'healthy' | 'stale' | 'unreachable';

export interface AccountLimits {
  account: AccountName | null;
  label: string;
  routines: number;
  limits: CurrentUsageLimit[];
  updatedAt: string;
}
