import { useQuery } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';

import { Popover } from 'design-system/components';
import { cn } from 'design-system/utils';
import { sameOriginApi } from 'utils/http';

import { getDaemonStatus } from '../requests';
import { checkIsUsageLow, formatUsageLeft, getClaudeLimits, getMostUsedLimit } from '../utils';
import { PlanUsageDetails } from './plan-usage-details';

// Reads the status that DaemonStatusIndicator polls. Below md it hides, and the plan shows in the
// popover of DaemonStatusIndicator instead.
export function PlanUsageIndicator() {
  const { data } = useQuery({
    queryKey: ['status'],
    queryFn: () => getDaemonStatus(sameOriginApi),
  });
  const limit = data && getMostUsedLimit(getClaudeLimits(data));
  if (data === undefined || limit === undefined) return null;
  const isLow = checkIsUsageLow(limit);
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'flex h-8 animate-in items-center max-md:hidden gap-1.5 rounded-full px-2.5 text-body-sm text-fg-muted tabular-nums transition-colors animation-duration-300 fade-in hover:bg-hover hover:text-fg data-[state=open]:bg-overlay',
          isLow && 'text-warning',
        )}
      >
        <Gauge aria-hidden="true" className="size-3.5 shrink-0" />
        <span>
          Claude <span className={cn(!isLow && 'text-fg-secondary')}>{formatUsageLeft(limit)}</span>{' '}
          left
          <span className="sr-only">, plan usage</span>
        </span>
      </Popover.Trigger>
      <Popover.Content side="bottom" align="end">
        <PlanUsageDetails status={data} />
      </Popover.Content>
    </Popover.Root>
  );
}
