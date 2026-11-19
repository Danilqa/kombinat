import type { z } from 'zod';

import type { queuedWebhookSchema, webhookCallOutcomeSchema, webhookCallSchema } from './schemas';

export type QueuedWebhook = z.infer<typeof queuedWebhookSchema>;
export type WebhookCallOutcome = z.infer<typeof webhookCallOutcomeSchema>;
export type WebhookCall = z.infer<typeof webhookCallSchema>;
