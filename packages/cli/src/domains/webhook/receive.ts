import { match } from 'ts-pattern';

import type { RunId } from 'domains/id/types';
import { createRunId } from 'domains/run/utils';

import type { Routine } from '../routine/types';
import { writePayload } from '../run/payload';
import { checkIsRunning, startDetachedRun } from '../run/runner';
import { decideWebhook } from './gate';
import type { WebhookRequest } from './gate';
import { countQueuedWebhooks, enqueueWebhook } from './queue';

interface NoWebhookOutcome {
  outcome: 'no_webhook';
}

interface StartedOutcome {
  outcome: 'started' | 'queued';
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

function startOrQueueRun(routine: Routine, payload: string): WebhookOutcome {
  if (!routine.enabled) return { outcome: 'disabled' };
  const runId = createRunId();
  if (checkIsRunning(routine.name) || countQueuedWebhooks(routine.name) > 0) {
    return enqueueWebhook(routine.name, runId, payload)
      ? { outcome: 'queued', runId }
      : { outcome: 'queue_full' };
  }
  if (payload !== '') writePayload(routine.name, runId, payload);
  startDetachedRun(routine.name, { trigger: 'webhook', runId });
  return { outcome: 'started', runId };
}

export async function receiveWebhook(
  routine: Routine,
  request: WebhookRequest,
): Promise<WebhookOutcome> {
  if (!routine.webhook) return { outcome: 'no_webhook' };
  const decision = await decideWebhook(routine, request);
  return match(decision)
    .with({ outcome: 'run' }, ({ payload }) => startOrQueueRun(routine, payload))
    .with({ outcome: 'ignore' }, ({ response }): WebhookOutcome => ({
      outcome: 'ignored',
      response,
    }))
    .with({ outcome: 'reject' }, ({ reason }): WebhookOutcome => ({ outcome: 'rejected', reason }))
    .with({ outcome: 'timeout' }, (): WebhookOutcome => ({ outcome: 'timed_out' }))
    .exhaustive();
}
