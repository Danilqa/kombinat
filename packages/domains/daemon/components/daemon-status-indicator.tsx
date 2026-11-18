import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { P, match } from 'ts-pattern';

import { Popover } from 'design-system/components';
import { cn } from 'design-system/utils';
import { formatRelative } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';

import { getDaemonStatus } from '../requests';
import type { CurrentUsageLimit, DaemonHealth, DaemonStatus } from '../types';
import {
  checkIsDiskLow,
  checkIsUsageLow,
  formatCpuLoad,
  formatDiskSpace,
  formatUsageLeft,
  getCurrentUsageLimits,
  getDaemonHealth,
  getLeftRatio,
  getMostUsedLimit,
} from '../utils';

interface DaemonHealthAppearance {
  label: string;
  dotClassName: string;
}

const daemonHealthAppearances: Record<DaemonHealth, DaemonHealthAppearance> = {
  healthy: { label: 'Scheduler is ticking', dotClassName: 'bg-positive' },
  stale: { label: 'Scheduler has not ticked recently', dotClassName: 'bg-warning' },
  unreachable: { label: 'Daemon is unreachable', dotClassName: 'bg-negative' },
};

const triggerClassName =
  'flex h-8 items-center gap-2 rounded-full px-2.5 text-body-sm text-fg-muted tabular-nums';

function checkHasRunning(status: DaemonStatus | undefined): boolean {
  return status !== undefined && status.running > 0;
}

function getClaudeLimits(status: DaemonStatus): CurrentUsageLimit[] {
  return getCurrentUsageLimits(status.claudeUsage, new Date(status.now).getTime());
}

interface PlanUsageSummaryProps {
  status: DaemonStatus;
}

function PlanUsageSummary({ status }: PlanUsageSummaryProps) {
  const limit = getMostUsedLimit(getClaudeLimits(status));
  if (limit === undefined) return null;
  const isLow = checkIsUsageLow(limit);
  return (
    <span className={cn(isLow && 'text-warning')}>
      <span aria-hidden="true"> · </span>
      <span className={cn(!isLow && 'text-fg-secondary')}>{formatUsageLeft(limit)}</span> left
      <span className="sr-only"> of the Claude plan</span>
    </span>
  );
}

interface DaemonStatusSummaryProps {
  health: DaemonHealth;
  status: DaemonStatus | undefined;
}

// Every unhealthy state gets its own visible text, so the dot colour is not the only cue.
function DaemonStatusSummary({ health, status }: DaemonStatusSummaryProps) {
  return match({ health, status })
    .with({ health: 'stale' }, () => <span className="text-warning">Scheduler stalled</span>)
    .with({ health: 'healthy', status: P.nonNullable }, ({ status: healthy }) => (
      <span>
        <span className="text-fg-secondary">{healthy.running}</span> of{' '}
        <span className="text-fg-secondary">{healthy.maxConcurrentRuns}</span> running
        <PlanUsageSummary status={healthy} />
      </span>
    ))
    .otherwise(() => <span>Offline</span>);
}

interface PlanUsageDetailsProps {
  status: DaemonStatus;
}

function PlanUsageDetails({ status }: PlanUsageDetailsProps) {
  const usage = status.claudeUsage;
  const limits = getClaudeLimits(status);
  if (!usage || limits.length === 0) return null;
  return (
    <>
      <p className="mt-3 mb-1.5 font-medium">Claude plan</p>
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
                  · resets <time dateTime={limit.resetsAt}>{formatRelative(limit.resetsAt)}</time>
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
          <time dateTime={usage.updatedAt}>{formatRelative(usage.updatedAt)}</time>
        </dd>
      </dl>
    </>
  );
}

interface DaemonStatusDetailsProps {
  status: DaemonStatus;
}

function DaemonStatusDetails({ status }: DaemonStatusDetailsProps) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
      <dt className="text-fg-muted">Running</dt>
      <dd className="tabular-nums">
        {status.running} of {status.maxConcurrentRuns}
      </dd>
      <dt className="text-fg-muted">Daemon pid</dt>
      <dd className="font-mono tabular-nums">{status.pid}</dd>
      <dt className="text-fg-muted">Last tick</dt>
      <dd className="tabular-nums">
        {status.lastTickAt === null ? (
          'never'
        ) : (
          <time dateTime={status.lastTickAt}>{formatRelative(status.lastTickAt)}</time>
        )}
      </dd>
      <dt className="text-fg-muted">Time zone</dt>
      <dd className="font-mono">{status.timezone}</dd>
      {status.disk && (
        <>
          <dt className="text-fg-muted">Disk</dt>
          <dd className={cn('tabular-nums', checkIsDiskLow(status.disk) && 'text-warning')}>
            {formatDiskSpace(status.disk)}
          </dd>
        </>
      )}
      {status.cpuLoad !== undefined && (
        <>
          <dt className="text-fg-muted">CPU load</dt>
          <dd className="tabular-nums">{formatCpuLoad(status.cpuLoad)}</dd>
        </>
      )}
    </dl>
  );
}

export function DaemonStatusIndicator() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['status'],
    queryFn: () => getDaemonStatus(sameOriginApi),
    refetchInterval: query => getPollInterval(checkHasRunning(query.state.data)),
  });
  if (isPending) {
    // Holds the width of the loaded summary so the navigation next to it does not jump.
    return (
      <span aria-hidden="true" className={cn(triggerClassName, 'invisible')}>
        <span className="size-1.5" />0 of 0 running
      </span>
    );
  }
  const health = getDaemonHealth(data, isError);
  const appearance = daemonHealthAppearances[health];
  return (
    <>
      <span role="status" className="sr-only">
        {appearance.label}
      </span>
      <Popover.Root>
        <Popover.Trigger
          className={cn(
            triggerClassName,
            'animate-in transition-colors animation-duration-300 fade-in hover:bg-hover hover:text-fg data-[state=open]:bg-overlay',
          )}
        >
          <span aria-hidden="true" className="relative flex size-1.5 shrink-0">
            {checkHasRunning(data) && (
              <span
                className={cn(
                  'absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping',
                  appearance.dotClassName,
                )}
              />
            )}
            <span
              className={cn(
                'relative inline-flex size-1.5 rounded-full transition-colors duration-300 forced-colors:bg-[CanvasText]',
                appearance.dotClassName,
              )}
            />
          </span>
          <DaemonStatusSummary health={health} status={data} />
          <span className="sr-only">, daemon status</span>
        </Popover.Trigger>
        <Popover.Content side="bottom" align="end">
          <p className="mb-1.5 font-medium">{appearance.label}</p>
          {data && <DaemonStatusDetails status={data} />}
          {data && <PlanUsageDetails status={data} />}
        </Popover.Content>
      </Popover.Root>
    </>
  );
}
