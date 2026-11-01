import { match } from 'ts-pattern';

import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';
import type { RunStatus, RunTrigger, SkipReason } from '@/lib/api';
import { cn } from '@/lib/utils';

interface StatusAppearance {
  label: string;
  variant: BadgeVariant;
  dotClassName: string;
  isPulsing: boolean;
}

function getStatusAppearance(status: RunStatus): StatusAppearance {
  return match(status)
    .with('running', (): StatusAppearance => ({
      label: 'Running',
      variant: 'warning',
      dotClassName: 'bg-dark-yellow',
      isPulsing: true,
    }))
    .with('succeeded', (): StatusAppearance => ({
      label: 'Succeeded',
      variant: 'positive',
      dotClassName: 'bg-dark-green',
      isPulsing: false,
    }))
    .with('failed', (): StatusAppearance => ({
      label: 'Failed',
      variant: 'negative',
      dotClassName: 'bg-dark-red',
      isPulsing: false,
    }))
    .with('timed_out', (): StatusAppearance => ({
      label: 'Timed out',
      variant: 'negative',
      dotClassName: 'bg-dark-red',
      isPulsing: false,
    }))
    .with('aborted', (): StatusAppearance => ({
      label: 'Aborted',
      variant: 'ghost',
      dotClassName: 'bg-grey-60',
      isPulsing: false,
    }))
    .exhaustive();
}

export function getTriggerLabel(trigger: RunTrigger): string {
  return match(trigger)
    .with('schedule', () => 'Scheduled')
    .with('manual', () => 'Manual')
    .with('catch_up', () => 'Catch-up')
    .exhaustive();
}

interface StatusBadgeProps {
  status: RunStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const appearance = getStatusAppearance(status);
  return (
    <Badge variant={appearance.variant}>
      <span className="relative flex size-2">
        {appearance.isPulsing && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-75',
              appearance.dotClassName,
            )}
          />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', appearance.dotClassName)} />
      </span>
      {appearance.label}
    </Badge>
  );
}

export function getSkipReasonLabel(reason: SkipReason): string {
  return match(reason)
    .with('already_running', () => 'already running')
    .with('concurrency_limit', () => 'concurrency limit')
    .with('disabled', () => 'disabled')
    .exhaustive();
}
