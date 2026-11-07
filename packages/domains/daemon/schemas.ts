import { z } from 'zod';

export const daemonStatusSchema = z.object({
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
});
