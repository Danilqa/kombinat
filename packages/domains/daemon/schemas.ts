import { z } from 'zod';

import { accountNameSchema } from '../agent/ids';

export const diskSpaceSchema = z.object({ freeBytes: z.number(), totalBytes: z.number() });

export const usageLimitSchema = z.object({ usedRatio: z.number(), resetsAt: z.string() });

export const planLimitsSchema = z.object({
  session: usageLimitSchema.nullable(),
  week: usageLimitSchema.nullable(),
});

export const planUsageSchema = planLimitsSchema.extend({ updatedAt: z.string() });

// A login that routines run on. name is null for the primary one.
export const accountStatusSchema = z.object({
  name: accountNameSchema.nullable(),
  routines: z.number(),
  claudeUsage: planUsageSchema.nullable(),
});

export const daemonStatusSchema = z.object({
  // Older daemons do not send version, disk, cpuLoad and claudeUsage, and tui --url may talk to one.
  version: z.string().optional(),
  pid: z.number(),
  startedAt: z.string(),
  lastTickAt: z.string().nullable(),
  routinesDir: z.string(),
  stateDir: z.string(),
  claudeBin: z.string(),
  codexBin: z.string(),
  maxConcurrentRuns: z.number(),
  running: z.number(),
  timezone: z.string(),
  now: z.string(),
  disk: diskSpaceSchema.nullable().optional(),
  cpuLoad: z.number().nullable().optional(),
  // The primary login's, as older clients read it.
  claudeUsage: planUsageSchema.nullable().optional(),
  // Older daemons do not send it, and tui --url may talk to one.
  accounts: z.array(accountStatusSchema).default([]),
});
