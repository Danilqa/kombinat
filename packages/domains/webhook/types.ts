import type { z } from 'zod';

import type { queuedWebhookSchema } from './schemas';

export type QueuedWebhook = z.infer<typeof queuedWebhookSchema>;
