import { RelativeTime } from 'design-system/components';

import type { QueuedWebhook } from '../types';
import { formatPayloadSize, getQueuePositionLabel } from '../utils';

interface WebhookQueueListProps {
  queue: QueuedWebhook[];
}

export function WebhookQueueList({ queue }: WebhookQueueListProps) {
  return (
    <ol className="max-h-80 divide-y divide-line-faint overflow-y-auto">
      {queue.map((webhook, index) => (
        <li key={webhook.runId} className="space-y-1 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-fg-muted">
            <span>
              {getQueuePositionLabel(index)} · queued <RelativeTime iso={webhook.queuedAt} />
            </span>
            <span className="tabular-nums">{formatPayloadSize(webhook.bytes)}</span>
          </div>
          {webhook.preview === '' ? (
            <p className="text-fg-muted">Empty body</p>
          ) : (
            <pre className="line-clamp-3 font-mono text-caption break-all whitespace-pre-wrap text-fg">
              {webhook.preview}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}
