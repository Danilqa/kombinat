import { z } from 'zod';

export const diskSpaceSchema = z.object({ freeBytes: z.number(), totalBytes: z.number() });

export const daemonStatusSchema = z.object({
  // Older daemons do not send version, disk and cpuLoad, and tui --url may talk to one.
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
});
