import { useState } from 'react';
import { Tooltip } from 'design-system/components';
import { cn } from 'design-system/utils';

export interface DayBarSegment {
  value: number;
  className: string;
}

interface DayBarProps {
  label: string;
  // Bottom first, each with a className of its own.
  segments: DayBarSegment[];
  maxTotal: number;
  caption: string | null;
  className?: string;
  tabIndex?: number;
}

export function DayBar({
  label,
  segments,
  maxTotal,
  caption,
  className,
  tabIndex = 0,
}: DayBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <Tooltip.Root open={isOpen} onOpenChange={setIsOpen}>
        {/* Radix closes a tooltip on click and ignores taps. Here a click or tap opens it. */}
        <Tooltip.Trigger
          asChild
          onClick={event => {
            event.preventDefault();
            setIsOpen(true);
          }}
        >
          <div
            role="img"
            aria-label={label}
            tabIndex={tabIndex}
            className={cn(
              'flex h-16 w-full cursor-default flex-col-reverse gap-px rounded-sm',
              className,
            )}
          >
            {total === 0 ? (
              <div className="h-0.5 w-full rounded-sm bg-line-strong" />
            ) : (
              segments
                .filter(segment => segment.value > 0)
                .map(segment => (
                  <div
                    key={segment.className}
                    className={cn('w-full rounded-sm', segment.className)}
                    style={{ height: `max(${(segment.value / maxTotal) * 100}%, 2px)` }}
                  />
                ))
            )}
          </div>
        </Tooltip.Trigger>
        <Tooltip.Content>{label}</Tooltip.Content>
      </Tooltip.Root>
      {caption !== null && (
        <span aria-hidden="true" className="text-body-sm text-fg-muted">
          {caption}
        </span>
      )}
    </li>
  );
}
