import { Link } from 'react-router';
import { PageTitle, SectionAside, SectionTitle } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/page-states';
import { RelativeTime } from '@/components/relative-time';
import { RunNowButton } from '@/components/run-now-button';
import { RunsTable } from '@/components/runs-table';
import { StatusBadge, getSkipReasonLabel } from '@/components/status-badge';
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

interface DaemonStatusLineProps {
  status: DaemonStatus;
}

function DaemonStatusLine({ status }: DaemonStatusLineProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-paragraph-14 text-grey-60">
      <span>
        daemon pid <span className="font-mono text-black">{status.pid}</span>
      </span>
      <span>
        last tick <RelativeTime iso={status.lastTickAt} className="font-mono text-black" />
      </span>
      <span className="font-mono text-black">{status.timezone}</span>
      <span>
        <span className="font-mono text-black tabular-nums">{status.running}</span> running of{' '}
        <span className="font-mono text-black tabular-nums">{status.maxConcurrentRuns}</span>
      </span>
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
          <span className="text-paragraph-12 text-grey-60 tabular-nums">
            <RelativeTime iso={lastRun.startedAt} />
          </span>
        </Link>
      ) : (
        <span className="text-grey-60">Never run</span>
      )}
      {lastSkip && (
        <div className="text-paragraph-12 text-grey-60">
          skipped <RelativeTime iso={lastSkip.at} /> ({getSkipReasonLabel(lastSkip.reason)})
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
          <TableRow key={routine.name} className={routine.enabled ? undefined : 'opacity-60'}>
            <TableCell>
              <Link
                to={`/routines/${encodeURIComponent(routine.name)}`}
                className="text-title-14 text-black hover:underline"
              >
                {routine.name}
              </Link>
              {!routine.enabled && <div className="text-paragraph-12 text-grey-60">disabled</div>}
            </TableCell>
            <TableCell className="max-w-56 min-w-36 whitespace-normal text-grey-70">
              <div className="line-clamp-2" title={routine.description}>
                {routine.description}
              </div>
            </TableCell>
            <TableCell className="min-w-36 whitespace-normal">
              <div>{routine.scheduleHuman}</div>
              {routine.schedule && (
                <div className="font-mono text-paragraph-12 text-grey-60">{routine.schedule}</div>
              )}
            </TableCell>
            <TableCell>
              <RelativeTime iso={routine.nextRunAt} />
            </TableCell>
            <TableCell>
              <div className="font-mono text-paragraph-12">
                {routine.model ?? routine.command ?? routine.agent}
              </div>
              <div className="text-paragraph-12 text-grey-60">
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
    <div className="space-y-10">
      <header className="space-y-2">
        <PageTitle>Kombinat</PageTitle>
        {data && <DaemonStatusLine status={data.status} />}
      </header>
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
  );
}
