import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAbsolute, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RelativeTimeProps {
  iso: string | null;
  className?: string;
}

export function RelativeTime({ iso, className }: RelativeTimeProps) {
  if (!iso) return <span className={cn('text-muted-foreground', className)}>-</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} className={cn('cursor-default whitespace-nowrap', className)}>
          {formatRelative(iso)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatAbsolute(iso)}</TooltipContent>
    </Tooltip>
  );
}
