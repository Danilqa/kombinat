import { useQuery } from '@tanstack/react-query';
import { ListOrdered } from 'lucide-react';
import { useState } from 'react';
import { match } from 'ts-pattern';

import { Button, Popover, RelativeTime } from 'design-system/components';
import { sameOriginApi } from 'utils/http';

import { formatPayloadSize, getQueuePositionLabel } from '../../run/utils';
import { getRoutine } from '../requests';

type WebhookQueueButtonLook = 'button' | 'inline';

interface WebhookQueueButtonProps {
  routine: string;
  count: number;
  look?: WebhookQueueButtonLook;
}

export function WebhookQueueButton({ routine, count, look = 'button' }: WebhookQueueButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data, error } = useQuery({
    queryKey: ['routines', routine],
    queryFn: () => getRoutine(sameOriginApi, routine),
    enabled: isOpen,
  });
  if (count === 0) return null;
  const queue = data?.queue ?? [];
  const shownCount = data?.queue.length ?? count;
  const label = (
    <>
      {count} in queue
      <span className="sr-only"> of {routine}</span>
    </>
  );
  const trigger = match(look)
    .with('button', () => (
      <Button variant="tertiary" size="small">
        <ListOrdered aria-hidden="true" className="size-3.5" />
        {label}
      </Button>
    ))
    .with('inline', () => (
      <button
        type="button"
        className="flex cursor-pointer items-center gap-1 text-body-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
      >
        <ListOrdered aria-hidden="true" className="size-3" />
        {label}
      </button>
    ))
    .exhaustive();

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      {/* Portaled clicks still bubble to the row link. */}
      <Popover.Content
        align="end"
        aria-label={`Webhook queue of ${routine}`}
        className="w-96 max-w-[calc(100vw-2rem)] px-0 py-0"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-line px-3 py-2.5">
          <div className="font-medium">
            {shownCount} {shownCount === 1 ? 'webhook' : 'webhooks'} in queue
          </div>
        </div>
        {error && (
          <p role="alert" className="px-3 py-2.5 text-negative">
            {error.message}
          </p>
        )}
        {data === undefined && error === null && (
          <p className="px-3 py-2.5 text-fg-muted">Loading…</p>
        )}
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
      </Popover.Content>
    </Popover.Root>
  );
}
