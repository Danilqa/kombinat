import { z } from 'zod';

import { runIdSchema } from '../id/schemas';

export const queuedWebhookSchema = z.object({
  runId: runIdSchema,
  queuedAt: z.string(),
  bytes: z.number(),
  preview: z.string(),
});
