import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import type { RunRecord } from 'domains/run/types';
import { checkCanContinueRun, checkIsRunActive } from 'domains/run/utils';

import { writePayload } from '../run/payload';
import { findStartingConversationRun, startDetachedReply, startDetachedRun } from '../run/runner';
import { listRuns } from '../run/storage';
import { findQueuedConversation } from './queue';
import type { WebhookRun } from './queue';

function findNewestConversationRun(routine: RoutineName, conversation: string): RunRecord | null {
  return listRuns(routine).find(candidate => candidate.conversation === conversation) ?? null;
}

function findConversationRun(routine: RoutineName, conversation: string): RunRecord | null {
  const run = findNewestConversationRun(routine, conversation);
  return run !== null && checkCanContinueRun(run) ? run : null;
}

// A run still at work may not have reported its session yet, so it counts as the conversation's run.
export function getQueuedWebhookRunId(routine: RoutineName, webhook: WebhookRun): RunId {
  const { conversation } = webhook;
  if (conversation === null) return webhook.runId;
  const run = findNewestConversationRun(routine, conversation);
  if (run !== null && (checkIsRunActive(run) || checkCanContinueRun(run))) return run.id;
  return (
    findStartingConversationRun(routine, conversation) ??
    findQueuedConversation(routine, conversation) ??
    webhook.runId
  );
}

export function startWebhook(routine: RoutineName, webhook: WebhookRun): RunId {
  const run =
    webhook.conversation === null ? null : findConversationRun(routine, webhook.conversation);
  if (run !== null) {
    startDetachedReply(run, { text: webhook.payload, source: 'webhook' });
    return run.id;
  }
  if (webhook.payload !== '') writePayload(routine, webhook.runId, webhook.payload);
  startDetachedRun(routine, {
    trigger: 'webhook',
    runId: webhook.runId,
    conversation: webhook.conversation,
  });
  return webhook.runId;
}
