import { z } from 'zod';

export const settingsSchema = z.object({
  runRetentionDays: z.number().int().positive().nullable(),
});
