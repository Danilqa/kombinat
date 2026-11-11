import { useState } from 'react';
import { match } from 'ts-pattern';

import { Badge, type BadgeVariant } from 'design-system/components';
import { cn } from 'design-system/utils';

import type { RunStatus } from '../types';
import { getRunStatusLabel } from '../utils';

interface StatusAppearance {
  variant: BadgeVariant;
  dotClassName: string;
  isPulsing: boolean;
}

function getStatusAppearance(status: RunStatus): StatusAppearance {
  return match(status)
    .with('running', (): StatusAppearance => ({
      variant: 'warning',
      dotClassName: 'bg-warning',
      isPulsing: true,
    }))
    .with('succeeded', (): StatusAppearance => ({
      variant: 'positive',
      dotClassName: 'bg-positive',
      isPulsing: false,
    }))
    .with('failed', (): StatusAppearance => ({
      variant: 'negative',
      dotClassName: 'bg-negative',
      isPulsing: false,
    }))
    .with('timed_out', (): StatusAppearance => ({
      variant: 'negative',
      dotClassName: 'bg-negative',
      isPulsing: false,
    }))
    .with('aborted', (): StatusAppearance => ({
      variant: 'ghost',
      dotClassName: 'bg-fg-faint',
      isPulsing: false,
    }))
    .exhaustive();
}

interface RunStatusBadgeProps {
  status: RunStatus;
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const appearance = getStatusAppearance(status);
  const [initialStatus] = useState(status);
  return (
    <Badge
      key={status}
      variant={appearance.variant}
      size="medium"
      className={cn(status !== initialStatus && 'animate-status-pop')}
    >
      <span className="relative flex size-1.5 shrink-0">
        {appearance.isPulsing && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              appearance.dotClassName,
            )}
          />
        )}
        <span
          className={cn('relative inline-flex size-1.5 rounded-full', appearance.dotClassName)}
        />
      </span>
      {getRunStatusLabel(status)}
    </Badge>
  );
}
