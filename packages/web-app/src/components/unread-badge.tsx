import { cn } from 'design-system/utils';

interface UnreadBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function UnreadBadge({ count, max = Infinity, className }: UnreadBadgeProps) {
  return (
    <span
      className={cn(
        'min-w-4.5 animate-in rounded-full bg-fg px-1.5 text-center text-caption leading-4.5 text-page tabular-nums duration-200 zoom-in-90 fade-in',
        className,
      )}
    >
      <span aria-hidden="true">{count > max ? `${max}+` : count}</span>
      <span className="sr-only"> {count} unread</span>
    </span>
  );
}
