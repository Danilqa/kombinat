import { formatAbsolute, formatRelative } from 'utils/date-time';
import { cn } from '../utils';
import * as Tooltip from './tooltip';

interface RelativeTimeProps {
  iso: string | null;
  // Lets keyboard users open the tooltip. Off by default to keep tables to one stop per link.
  isFocusable?: boolean;
  className?: string;
}

export function RelativeTime({ iso, isFocusable = false, className }: RelativeTimeProps) {
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
