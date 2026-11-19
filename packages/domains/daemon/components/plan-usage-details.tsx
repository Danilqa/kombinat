import { Fragment } from 'react';

import { cn } from 'design-system/utils';

import type { DaemonStatus } from '../types';
import { checkIsUsageLow, formatUsageLeft, getClaudeLimits, getLeftRatio } from '../utils';
import { LiveRelativeTime } from './live-relative-time';

interface PlanUsageDetailsProps {
  status: DaemonStatus;
  className?: string;
}

export function PlanUsageDetails({ status, className }: PlanUsageDetailsProps) {
  const usage = status.claudeUsage;
  const limits = getClaudeLimits(status);
  if (!usage || limits.length === 0) return null;
  return (
    <div className={className}>
      <p className="mb-1.5 font-medium">Claude plan</p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {limits.map(limit => {
          const isLow = checkIsUsageLow(limit);
          return (
            <Fragment key={limit.label}>
              <dt className="text-fg-muted">{limit.label}</dt>
              <dd className="tabular-nums">
                <span className={cn(isLow && 'text-warning')}>{formatUsageLeft(limit)} left</span>
                <span className="text-fg-muted">
                  {' '}
                  · resets <LiveRelativeTime iso={limit.resetsAt} />
                </span>
                <span aria-hidden="true" className="mt-1 mb-1.5 block h-1 rounded-full bg-overlay">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      isLow ? 'bg-warning' : 'bg-fg-secondary',
                    )}
                    style={{ width: `${getLeftRatio(limit) * 100}%` }}
                  />
                </span>
              </dd>
            </Fragment>
          );
        })}
        <dt className="text-fg-muted">Updated</dt>
        <dd className="tabular-nums">
          <LiveRelativeTime iso={usage.updatedAt} />
        </dd>
      </dl>
    </div>
  );
}
