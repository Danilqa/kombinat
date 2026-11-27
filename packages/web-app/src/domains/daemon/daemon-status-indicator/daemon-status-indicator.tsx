import type { ReactNode } from 'react';
import { P, match } from 'ts-pattern';

import { PingingStatusDot, Popover, type StatusDotTone, cn } from 'design-system';
import type { DaemonHealth, DaemonStatus } from 'domains/daemon/types';
import {
  checkIsDiskLow,
  formatCpuLoad,
  formatDiskSpace,
  getDaemonHealth,
} from 'domains/daemon/utils';
import { LiveRelativeTime } from '../live-relative-time';
import { PlanUsageDetails } from '../plan-usage-details';
import { useDaemonStatus } from '../queries';

interface DaemonHealthAppearance {
  label: string;
  hint: ReactNode;
  tone: StatusDotTone;
}

const daemonHealthAppearances: Record<DaemonHealth, DaemonHealthAppearance> = {
  healthy: { label: 'Scheduler is ticking', hint: null, tone: 'positive' },
  stale: { label: 'Scheduler has not ticked recently', hint: null, tone: 'warning' },
  unreachable: {
    label: 'Daemon is unreachable',
    hint: (
      <>
        Check it with <code className="font-mono">kombinat status</code> in your routines folder.
      </>
    ),
    tone: 'negative',
  },
};

const triggerClassName =
  'flex h-8 items-center gap-2 rounded-full px-2.5 text-body-sm text-fg-muted tabular-nums';

function checkHasRunning(status: DaemonStatus | undefined): boolean {
  return status !== undefined && status.running > 0;
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
      </span>
    ))
    .otherwise(() => <span>Offline</span>);
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
      <dt className="text-fg-muted">Daemon PID</dt>
      <dd className="font-mono tabular-nums">{status.pid}</dd>
      <dt className="text-fg-muted">Last tick</dt>
      <dd className="tabular-nums">
        {status.lastTickAt === null ? 'never' : <LiveRelativeTime iso={status.lastTickAt} />}
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
  const { data, isError, isFetched, isPending } = useDaemonStatus({ isPolling: true });
  // A query without data is pending again while it refetches, and the daemon is still unreachable then.
  if (isPending && !isFetched) {
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
          <PingingStatusDot
            aria-hidden="true"
            tone={appearance.tone}
            isPinging={checkHasRunning(data)}
            className="transition-colors duration-300 forced-colors:bg-[CanvasText]"
          />
          <DaemonStatusSummary health={health} status={data} />
          <span className="sr-only">, daemon status</span>
        </Popover.Trigger>
        {/* Several accounts can be taller than a phone, so the popover scrolls. */}
        <Popover.Content
          side="bottom"
          align="end"
          className="max-h-(--radix-popover-content-available-height) overflow-y-auto"
        >
          <p className="mb-1.5 font-medium">{appearance.label}</p>
          {appearance.hint && <p className="text-fg-muted">{appearance.hint}</p>}
          {data && <DaemonStatusDetails status={data} />}
          {data && <PlanUsageDetails status={data} className="mt-3 md:hidden" />}
        </Popover.Content>
      </Popover.Root>
    </>
  );
}
