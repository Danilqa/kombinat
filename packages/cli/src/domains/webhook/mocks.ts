import { runIdSchema } from 'domains/run/ids';

import type { WebhookRun } from './queue';

export function makeWebhook(
  runId: string,
  payload: string,
  conversation: string | null = null,
): WebhookRun {
  return { runId: runIdSchema.parse(runId), payload, conversation };
}
