import { z } from 'zod';

export const queuedWebhookSchema = z.object({
  runId: z.string(),
  queuedAt: z.string(),
  bytes: z.number(),
  preview: z.string(),
});
