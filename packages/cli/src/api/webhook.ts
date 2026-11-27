import { match, P } from 'ts-pattern';

import type { RoutineName } from 'domains/routine/ids';
import { getErrorMessage } from 'utils/error';

import type { Routine } from '../domains/routine/types';
import { logWebhookCall } from '../domains/webhook/call-log';
import { WEBHOOK_GATE_TIMEOUT_MS } from '../domains/webhook/gate';
import { WEBHOOK_QUEUE_LIMIT } from '../domains/webhook/queue';
import { receiveWebhook } from '../domains/webhook/receive';
import type { WebhookOutcome } from '../domains/webhook/receive';
import { fail, ok } from './response';
import type { ApiContext, ApiResponse } from './response';

// Linear treats anything but 200 as a failed delivery.
function toWebhookResponse(
  name: RoutineName,
  outcome: WebhookOutcome,
  context: ApiContext,
): ApiResponse {
  return match(outcome)
    .with({ outcome: 'no_webhook' }, () =>
      fail(404, `${name} has no webhook, add webhook: true to its frontmatter`),
    )
    .with({ outcome: P.union('started', 'continued', 'queued') }, ({ runId }) =>
      ok({ ok: true, runId }),
    )
    .with({ outcome: 'ignored' }, ({ response }) => ok(response ?? { ok: true, runId: null }))
    .with({ outcome: 'rejected' }, ({ reason }) => {
      context.log(`webhookGate of ${name} ${reason}`);
      return fail(401, 'webhookGate rejected the request');
    })
    .with({ outcome: 'timed_out' }, () => {
      context.log(`webhookGate of ${name} timed out`);
      return fail(504, `webhookGate took longer than ${WEBHOOK_GATE_TIMEOUT_MS / 1000} s`);
    })
    .with({ outcome: 'disabled' }, () =>
      fail(409, `${name} is disabled, set enabled: true in its frontmatter`),
    )
    .with({ outcome: 'queue_full' }, () =>
      fail(429, `${name} already has ${WEBHOOK_QUEUE_LIMIT} webhooks waiting`),
    )
    .exhaustive();
}

export async function handleWebhook(routine: Routine, context: ApiContext): Promise<ApiResponse> {
  const receivedAt = new Date();
  const outcome = await receiveWebhook(routine, context.request);
  const response = toWebhookResponse(routine.name, outcome, context);
  // The run has started by now, so a sender that saw an error would send it again.
  try {
    logWebhookCall(routine.name, {
      receivedAt,
      outcome,
      status: response.status,
      body: context.request.body,
    });
  } catch (err) {
    context.log(`logging a webhook call of ${routine.name} failed: ${getErrorMessage(err)}`);
  }
  return response;
}
