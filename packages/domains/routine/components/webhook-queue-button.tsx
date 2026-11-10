import { useQuery } from '@tanstack/react-query';
import { ListOrdered } from 'lucide-react';
import { useState } from 'react';
import { match } from 'ts-pattern';

import { Badge, Button, Popover } from 'design-system/components';
import { sameOriginApi } from 'utils/http';

import { WebhookQueueList } from '../../webhook/components/webhook-queue-list';
import { getRoutine } from '../requests';

type WebhookQueueButtonLook = 'button' | 'chip';

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
  const shownCount = data?.queue.length ?? count;
  const routineLabel = <span className="sr-only"> for {routine}</span>;
  const trigger = match(look)
    .with('button', () => (
      <Button variant="tertiary" size="small">
        <ListOrdered aria-hidden="true" className="size-3.5" />
        {count} in queue
        {routineLabel}
      </Button>
    ))
    .with('chip', () => (
      <Badge asChild size="medium">
        <button type="button" className="cursor-pointer hover:text-fg hover:brightness-125">
          {count} queued
          {routineLabel}
        </button>
      </Badge>
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
        <WebhookQueueList queue={data?.queue ?? []} />
      </Popover.Content>
    </Popover.Root>
  );
}
