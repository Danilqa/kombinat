import { match } from 'ts-pattern';

import type { RunId } from 'domains/run/ids';
import { createRunId } from 'domains/run/utils';

import type { Routine } from '../routine/types';
import { checkIsRunning } from '../run/runner';
import { decideWebhook } from './gate';
import type { WebhookRequest } from './gate';
import { countQueuedWebhooks, enqueueWebhook } from './queue';
import { getQueuedWebhookRunId, startWebhook } from './start';

interface NoWebhookOutcome {
  outcome: 'no_webhook';
}

interface StartedOutcome {
  outcome: 'started' | 'continued' | 'queued';
  runId: RunId;
}

interface IgnoredOutcome {
  outcome: 'ignored';
  response: unknown;
}

interface RejectedOutcome {
  outcome: 'rejected';
  reason: string;
}

interface FailedOutcome {
  outcome: 'timed_out' | 'disabled' | 'queue_full';
}

export type WebhookOutcome =
  NoWebhookOutcome | StartedOutcome | IgnoredOutcome | RejectedOutcome | FailedOutcome;

function startOrQueueRun(
  routine: Routine,
  payload: string,
  conversation: string | null,
): WebhookOutcome {
  if (!routine.enabled) return { outcome: 'disabled' };
  const webhook = { runId: createRunId(), payload, conversation };
  if (checkIsRunning(routine.name) || countQueuedWebhooks(routine.name) > 0) {
    const runId = getQueuedWebhookRunId(routine.name, webhook);
    return enqueueWebhook(routine.name, webhook)
      ? { outcome: 'queued', runId }
      : { outcome: 'queue_full' };
  }
  const runId = startWebhook(routine.name, webhook);
  return { outcome: runId === webhook.runId ? 'started' : 'continued', runId };
}

export async function receiveWebhook(
  routine: Routine,
  request: WebhookRequest,
): Promise<WebhookOutcome> {
  if (!routine.webhook) return { outcome: 'no_webhook' };
  const decision = await decideWebhook(routine, request);
  return match(decision)
    .with({ outcome: 'run' }, ({ payload }) => startOrQueueRun(routine, payload, null))
    .with({ outcome: 'continue' }, ({ conversation, message }) =>
      startOrQueueRun(routine, message, conversation),
    )
    .with({ outcome: 'ignore' }, ({ response }): WebhookOutcome => ({
      outcome: 'ignored',
      response,
    }))
    .with({ outcome: 'reject' }, ({ reason }): WebhookOutcome => ({ outcome: 'rejected', reason }))
    .with({ outcome: 'timeout' }, (): WebhookOutcome => ({ outcome: 'timed_out' }))
    .exhaustive();
}
