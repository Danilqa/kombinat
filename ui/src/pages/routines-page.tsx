import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { Breadcrumbs, SectionAside, SectionTitle } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/page-states';
import { RelativeTime } from '@/components/relative-time';
import { RunNowButton } from '@/components/run-now-button';
import { RunsTable } from '@/components/runs-table';
import { StatusBadge, getSkipReasonLabel } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WeekCalendar } from '@/components/week-calendar';
import {
  getRoutines,
  getRuns,
  getStatus,
  type DaemonStatus,
  type RoutineSummary,
  type RunRecord,
} from '@/lib/api';
import { usePolledData } from '@/lib/use-polled-data';
import { cn } from '@/lib/utils';

const STALE_TICK_MS = 5 * 60_000;

interface Overview {
  status: DaemonStatus;
  routines: RoutineSummary[];
  runs: RunRecord[];
}

async function loadOverview(): Promise<Overview> {
  const [status, routines, runs] = await Promise.all([getStatus(), getRoutines(), getRuns(20)]);
  return { status, routines, runs };
}

function getHasActiveRuns(overview: Overview): boolean {
  return overview.status.running > 0 || overview.routines.some(routine => routine.running);
}

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

function getIsTickStale(status: DaemonStatus): boolean {
  if (status.lastTickAt === null) return true;
  return new Date(status.now).getTime() - new Date(status.lastTickAt).getTime() > STALE_TICK_MS;
}

function getDaemonHealth(status: DaemonStatus, hasError: boolean): DaemonHealth {
  return match({ hasError, isStale: getIsTickStale(status) })
    .with({ hasError: true }, () => 'unreachable' as const)
    .with({ isStale: true }, () => 'stale' as const)
    .otherwise(() => 'healthy' as const);
}

const statusValueClassName = 'text-fg-secondary tabular-nums';

function StatusSeparator() {
  return (
    <span aria-hidden="true" className="mx-1.5 text-fg-faint">
      ·
    </span>
  );
}

interface DaemonStatusLineProps {
  status: DaemonStatus;
  hasError: boolean;
}

function DaemonStatusLine({ status, hasError }: DaemonStatusLineProps) {
  const health = daemonHealthAppearances[getDaemonHealth(status, hasError)];
  return (
    <div className="flex min-w-0 items-center gap-2 text-body-sm text-fg-muted">
      <span
        role="img"
        aria-label={health.label}
        title={health.label}
        className={cn('size-1.5 shrink-0 rounded-full', health.dotClassName)}
      />
      <p className="min-w-0 truncate">
        Daemon pid <span className={cn(statusValueClassName, 'font-mono')}>{status.pid}</span>
        <StatusSeparator />
        last tick <RelativeTime iso={status.lastTickAt} className={statusValueClassName} />
        <StatusSeparator />
        <span className={cn(statusValueClassName, 'font-mono')}>{status.timezone}</span>
        <StatusSeparator />
        <span className={statusValueClassName}>{status.running}</span> of{' '}
        <span className={statusValueClassName}>{status.maxConcurrentRuns}</span> running
      </p>
    </div>
  );
}

interface LastRunCellProps {
  routine: RoutineSummary;
}

function LastRunCell({ routine }: LastRunCellProps) {
  const { lastRun, lastSkip } = routine;
  return (
    <div className="space-y-1">
      {lastRun ? (
        <Link
          to={`/runs/${encodeURIComponent(lastRun.routine)}/${encodeURIComponent(lastRun.id)}`}
          className="flex flex-col items-start gap-1"
        >
          <StatusBadge status={lastRun.status} />
          <span className="text-body-sm text-fg-muted tabular-nums">
            <RelativeTime iso={lastRun.startedAt} />
          </span>
        </Link>
      ) : (
        <span className="text-fg-muted">Never run</span>
      )}
      {lastSkip && (
        <div className="text-body-sm text-fg-muted">
          Skipped <RelativeTime iso={lastSkip.at} /> ({getSkipReasonLabel(lastSkip.reason)})
        </div>
      )}
    </div>
  );
}

interface RoutinesTableProps {
  routines: RoutineSummary[];
  onStarted: () => void;
}

function RoutinesTable({ routines, onStarted }: RoutinesTableProps) {
  if (routines.length === 0)
    return <p className="py-10 text-center text-body text-fg-muted">No routines yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Routine</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Next run</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {routines.map(routine => (
          <TableRow key={routine.name}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Link
                  to={`/routines/${encodeURIComponent(routine.name)}`}
                  className={cn(
                    'text-body font-medium underline-offset-4 hover:underline',
                    routine.enabled ? 'text-fg' : 'text-fg-secondary',
                  )}
                >
                  {routine.name}
                </Link>
                {!routine.enabled && (
                  <Badge size="small" variant="ghost">
                    Disabled
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="max-w-56 min-w-36 whitespace-normal text-fg-secondary">
              <div className="line-clamp-2" title={routine.description}>
                {routine.description}
              </div>
            </TableCell>
            <TableCell className="min-w-36 whitespace-normal">
              <div className="text-fg">{routine.scheduleHuman}</div>
              {routine.schedule && (
                <div className="font-mono text-body-sm text-fg-muted">{routine.schedule}</div>
              )}
            </TableCell>
            <TableCell className="text-fg-secondary tabular-nums">
              <RelativeTime iso={routine.nextRunAt} />
            </TableCell>
            <TableCell>
              <div
                className="max-w-56 truncate font-mono text-body-sm text-fg"
                title={routine.model ?? routine.command ?? routine.agent}
              >
                {routine.model ?? routine.command ?? routine.agent}
              </div>
              <div className="text-body-sm text-fg-muted">
                {routine.agent}
                {routine.effort !== null && ` · effort ${routine.effort}`}
              </div>
            </TableCell>
            <TableCell>
              <LastRunCell routine={routine} />
            </TableCell>
            <TableCell>
              <RunNowButton
                routine={routine.name}
                isRunning={routine.running}
                onStarted={onStarted}
                variant="secondary"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function RoutinesPage() {
  const { data, error, reload } = usePolledData('overview', loadOverview, getHasActiveRuns);

  return (
    <div>
      <Breadcrumbs
        crumbs={[]}
        aside={data && <DaemonStatusLine status={data.status} hasError={error !== null} />}
      />
      <h1 className="sr-only">Routines</h1>
      <div className="space-y-10">
        <WeekCalendar />
        {error && <ErrorState message={error} />}
        {!data && !error && <LoadingState />}
        {data && (
          <>
            <section>
              <SectionTitle aside={<SectionAside>{data.routines.length} routines</SectionAside>}>
                Routines
              </SectionTitle>
              <Card className="gap-0 py-0">
                <RoutinesTable routines={data.routines} onStarted={reload} />
              </Card>
            </section>
            <section>
              <SectionTitle>Recent runs</SectionTitle>
              <Card className="gap-0 py-0">
                <RunsTable runs={data.runs} hasRoutineColumn />
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
