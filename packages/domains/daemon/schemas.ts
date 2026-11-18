import { z } from 'zod';

export const diskSpaceSchema = z.object({ freeBytes: z.number(), totalBytes: z.number() });

export const usageLimitSchema = z.object({ usedRatio: z.number(), resetsAt: z.string() });

export const planLimitsSchema = z.object({
  session: usageLimitSchema.nullable(),
  week: usageLimitSchema.nullable(),
});

export const planUsageSchema = planLimitsSchema.extend({ updatedAt: z.string() });

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
  claudeUsage: planUsageSchema.nullable().optional(),
});
