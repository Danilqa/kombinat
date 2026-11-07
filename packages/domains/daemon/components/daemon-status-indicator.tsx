import { P, match } from 'ts-pattern';

import { Popover } from 'design-system/components';
import { cn } from 'design-system/utils';
import { formatRelative } from 'utils/date-time';
import { usePolledData } from 'utils/hooks/use-polled-data';
import { sameOriginApi } from 'utils/http';

import { getDaemonStatus } from '../requests';
import type { DaemonHealth, DaemonStatus } from '../types';
import { getDaemonHealth } from '../utils';

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

function getHasRunning(status: DaemonStatus): boolean {
  return status.running > 0;
}

interface DaemonStatusSummaryProps {
  health: DaemonHealth;
  status: DaemonStatus | null;
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
    </dl>
  );
}

export function DaemonStatusIndicator() {
  const { data, error, isLoading } = usePolledData(
    'status',
    () => getDaemonStatus(sameOriginApi),
    getHasRunning,
  );
  if (isLoading) {
    // Holds the width of the loaded summary so the navigation next to it does not jump.
    return (
      <span aria-hidden="true" className={cn(triggerClassName, 'invisible')}>
        <span className="size-1.5" />0 of 0 running
      </span>
    );
  }
  const health = getDaemonHealth(data, error !== null);
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
            'transition-colors hover:bg-hover hover:text-fg data-[state=open]:bg-overlay',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rounded-full forced-colors:bg-[CanvasText]',
              appearance.dotClassName,
            )}
          />
          <DaemonStatusSummary health={health} status={data} />
          <span className="sr-only">, daemon status</span>
        </Popover.Trigger>
        <Popover.Content side="bottom" align="end">
          <p className="mb-1.5 font-medium">{appearance.label}</p>
          {data && <DaemonStatusDetails status={data} />}
        </Popover.Content>
      </Popover.Root>
    </>
  );
}
