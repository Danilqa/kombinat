import * as React from 'react';
import { cn } from '../utils';

type StatusDotTone = 'positive' | 'negative' | 'warning' | 'info' | 'ghost';

const toneClassNames: Record<StatusDotTone, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  warning: 'bg-warning',
  info: 'bg-info',
  ghost: 'bg-fg-faint',
};

interface StatusDotProps extends React.ComponentProps<'span'> {
  tone: StatusDotTone;
}

function StatusDot({ tone, className, ...props }: StatusDotProps) {
  return (
    <span className={cn('size-1.5 rounded-full', toneClassNames[tone], className)} {...props} />
  );
}

interface PingingStatusDotProps extends StatusDotProps {
  isPinging: boolean;
}

// Keeps a box for the ring while the ring is off, so the dot stays the same element when the ring
// comes and goes and its colour can fade.
function PingingStatusDot({ tone, isPinging, className, ...props }: PingingStatusDotProps) {
  const toneClassName = toneClassNames[tone];
  return (
    <span className="relative flex size-1.5 shrink-0" {...props}>
      {isPinging && (
        <span
          className={cn(
            'absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping',
            toneClassName,
          )}
        />
      )}
      <span
        className={cn('relative inline-flex size-1.5 rounded-full', toneClassName, className)}
      />
    </span>
  );
}

export { PingingStatusDot, StatusDot, type StatusDotTone };
