import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAbsolute, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RelativeTimeProps {
  iso: string | null;
  className?: string;
}

export function RelativeTime({ iso, className }: RelativeTimeProps) {
  if (!iso) return <span className={cn('text-fg-muted', className)}>-</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={iso}
          className={cn('cursor-default whitespace-nowrap tabular-nums', className)}
        >
          {formatRelative(iso)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatAbsolute(iso)}</TooltipContent>
    </Tooltip>
  );
}
