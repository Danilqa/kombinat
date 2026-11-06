import { Tooltip, TooltipContent, TooltipTrigger } from '@web-app/components/ui/tooltip';
import { formatAbsolute, formatRelative } from '@web-app/lib/format';
import { cn } from '@web-app/lib/utils';

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
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={iso}
          tabIndex={isFocusable ? 0 : undefined}
          className={cn('cursor-default whitespace-nowrap tabular-nums', className)}
        >
          {formatRelative(iso)}
          <span className="sr-only"> ({absolute})</span>
        </time>
      </TooltipTrigger>
      <TooltipContent>{absolute}</TooltipContent>
    </Tooltip>
  );
}
