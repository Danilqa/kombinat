import { P, match } from 'ts-pattern';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getStatus, type DaemonStatus as DaemonStatusData } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { usePolledData } from '@/lib/use-polled-data';
import { cn } from '@/lib/utils';

const STALE_TICK_MS = 5 * 60_000;

type DaemonHealth = 'healthy' | 'stale' | 'unreachable';

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

function getIsTickStale(status: DaemonStatusData): boolean {
  if (status.lastTickAt === null) return true;
  return new Date(status.now).getTime() - new Date(status.lastTickAt).getTime() > STALE_TICK_MS;
}

function getDaemonHealth(status: DaemonStatusData | null, hasError: boolean): DaemonHealth {
  if (hasError || status === null) return 'unreachable';
  return getIsTickStale(status) ? 'stale' : 'healthy';
}

function getHasRunning(status: DaemonStatusData): boolean {
  return status.running > 0;
}

interface DaemonStatusSummaryProps {
  health: DaemonHealth;
  status: DaemonStatusData | null;
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
  status: DaemonStatusData;
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

export function DaemonStatus() {
  const { data, error, isLoading } = usePolledData('status', getStatus, getHasRunning);
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
      <Popover>
        <PopoverTrigger
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
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end">
          <p className="mb-1.5 font-medium">{appearance.label}</p>
          {data && <DaemonStatusDetails status={data} />}
        </PopoverContent>
      </Popover>
    </>
  );
}
