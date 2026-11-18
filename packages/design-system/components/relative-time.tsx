import { useSyncExternalStore } from 'react';
import { formatAbsolute, formatRelative } from 'utils/date-time';
import { cn } from '../utils';
import * as Tooltip from './tooltip';

const TICK_MS = 10_000;

const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | undefined;

function subscribeToTicks(listener: () => void): () => void {
  tickListeners.add(listener);
  tickTimer ??= setInterval(() => {
    for (const tickListener of tickListeners) tickListener();
  }, TICK_MS);
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size > 0) return;
    clearInterval(tickTimer);
    tickTimer = undefined;
  };
}

function getTick(): number {
  return Math.floor(Date.now() / TICK_MS);
}

interface RelativeTimeProps {
  iso: string | null;
  // Lets keyboard users open the tooltip. Off by default to keep tables to one stop per link.
  isFocusable?: boolean;
  className?: string;
}

export function RelativeTime({ iso, isFocusable = false, className }: RelativeTimeProps) {
  useSyncExternalStore(subscribeToTicks, getTick);
  if (!iso) return <span className={cn('text-fg-muted', className)}>-</span>;
  const absolute = formatAbsolute(iso);
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <time
          dateTime={iso}
          tabIndex={isFocusable ? 0 : undefined}
          className={cn('cursor-default whitespace-nowrap tabular-nums', className)}
        >
          {formatRelative(iso)}
          <span className="sr-only"> ({absolute})</span>
        </time>
      </Tooltip.Trigger>
      <Tooltip.Content>{absolute}</Tooltip.Content>
    </Tooltip.Root>
  );
}
