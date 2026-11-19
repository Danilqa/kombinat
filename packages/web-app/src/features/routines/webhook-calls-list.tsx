import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { Badge, type BadgeVariant, EmptyState, RelativeTime } from 'design-system/components';
import type { RoutineName } from 'domains/routine/ids';
import type { WebhookCall, WebhookCallOutcome } from 'domains/webhook/types';
import {
  formatPayloadSize,
  getWebhookCallOutcomeLabel,
  getWebhookPath,
} from 'domains/webhook/utils';
import { getRunPath } from '@web-app/constants/path';

function getStatusVariant(outcome: WebhookCallOutcome): BadgeVariant {
  return match(outcome)
    .with('started', 'continued', 'queued', (): BadgeVariant => 'positive')
    .with('ignored', (): BadgeVariant => 'neutral')
    .with('disabled', 'queue_full', (): BadgeVariant => 'warning')
    .with('rejected', 'timed_out', (): BadgeVariant => 'negative')
    .exhaustive();
}

interface WebhookCallRowProps {
  routine: RoutineName;
  call: WebhookCall;
}

function WebhookCallRow({ routine, call }: WebhookCallRowProps) {
  const label = getWebhookCallOutcomeLabel(call.outcome);
  // A queued call's run does not exist until the queue reaches it.
  const runId = match(call.outcome)
    .with('queued', () => null)
    .otherwise(() => call.runId);
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <Badge variant={getStatusVariant(call.outcome)} size="small" className="tabular-nums">
          {call.status}
        </Badge>
        {runId !== null ? (
          <Link
            to={getRunPath(routine, runId)}
            className="truncate text-body font-medium text-fg underline-offset-4 hover:underline"
          >
            {label}
          </Link>
        ) : (
          <span className="truncate text-body font-medium text-fg">{label}</span>
        )}
        <span className="ml-auto shrink-0 pl-2 text-body-sm text-fg-muted tabular-nums max-sm:ml-0 max-sm:basis-full max-sm:pl-0">
          <RelativeTime iso={call.receivedAt} /> · {formatPayloadSize(call.bytes)}
        </span>
      </div>
      {call.reason !== null && (
        <p className="text-body-sm break-words text-negative">{call.reason}</p>
      )}
      {call.preview === '' ? (
        <p className="text-body-sm text-fg-muted">Empty body</p>
      ) : (
        <pre className="line-clamp-3 font-mono text-caption break-all whitespace-pre-wrap text-fg-secondary">
          {call.preview}
        </pre>
      )}
    </li>
  );
}

interface WebhookCallsListProps {
  routine: RoutineName;
  calls: WebhookCall[];
}

export function WebhookCallsList({ routine, calls }: WebhookCallsListProps) {
  if (calls.length === 0) {
    return (
      <EmptyState>
        Calls to <code className="font-mono">POST {getWebhookPath(routine)}</code> show up here.
      </EmptyState>
    );
  }
  return (
    <ul aria-label="Webhook calls" className="divide-y divide-line">
      {calls.map(call => (
        <WebhookCallRow key={call.id} routine={routine} call={call} />
      ))}
    </ul>
  );
}
