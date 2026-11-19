import { z } from 'zod';

export const webhookCallIdSchema = z.string().brand<'WebhookCallId'>();

export type WebhookCallId = z.infer<typeof webhookCallIdSchema>;
