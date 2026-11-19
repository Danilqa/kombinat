import { match } from 'ts-pattern';

import type { RoutineName } from '../routine/ids';
import type { WebhookCall, WebhookCallOutcome } from './types';

export function getWebhookPath(routine: RoutineName): string {
  return `/api/routines/${encodeURIComponent(routine)}/webhook`;
}

export function formatPayloadSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function getQueuePositionLabel(index: number): string {
  return index === 0 ? 'Next' : `#${index + 1}`;
}

export function getWebhookCallOutcomeLabel(outcome: WebhookCallOutcome): string {
  return match(outcome)
    .with('started', () => 'Started a run')
    .with('continued', () => 'Continued a run')
    .with('queued', () => 'Queued')
    .with('ignored', () => 'Ignored by the gate')
    .with('rejected', () => 'Rejected by the gate')
    .with('timed_out', () => 'Gate timed out')
    .with('disabled', () => 'Routine disabled')
    .with('queue_full', () => 'Queue full')
    .exhaustive();
}

export function findExpiredWebhookCalls<T extends Pick<WebhookCall, 'receivedAt'>>(
  calls: T[],
  retentionDays: number,
  now: Date,
): T[] {
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  return calls.filter(call => new Date(call.receivedAt).getTime() < cutoff);
}
