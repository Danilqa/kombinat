import { Link } from 'react-router';
import { Badge } from 'design-system/components/badge';
import { Card } from 'design-system/components/card';
import { ErrorState, LoadingState } from 'design-system/components/page-states';
import { RelativeTime } from 'design-system/components/relative-time';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'design-system/components/table';
import { PageHeader, SectionAside } from 'design-system/layouts/page-header';
import { cn } from 'design-system/utils';
import { getRoutines } from 'domains/routine/requests';
import type { RoutineSummary } from 'domains/routine/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { sameOriginApi } from 'utils/http';
import { RunNowButton } from '@web-app/components/run-now-button';
import { StatusBadge } from '@web-app/components/status-badge';
import { useDocumentTitle } from '@web-app/lib/use-document-title';
import { usePolledData } from '@web-app/lib/use-polled-data';
import { useRowLink } from '@web-app/lib/use-row-link';

function getHasRunningRoutine(routines: RoutineSummary[]): boolean {
  return routines.some(routine => routine.running);
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
  const getRowClickHandler = useRowLink();
  if (routines.length === 0)
    return <p className="py-10 text-center text-body text-fg-muted">No routines yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Routine</TableHead>
          <TableHead className="max-md:hidden">Description</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Next run</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {routines.map(routine => (
          <TableRow
            key={routine.name}
            className="cursor-pointer"
            onClick={getRowClickHandler(`/routines/${encodeURIComponent(routine.name)}`)}
          >
            <TableCell className="max-sm:whitespace-normal">
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
            <TableCell className="max-w-56 min-w-36 whitespace-normal text-fg-secondary max-md:hidden">
              <div className="line-clamp-2" title={routine.description}>
                {routine.description}
              </div>
            </TableCell>
            <TableCell className="min-w-36 whitespace-normal max-sm:min-w-56">
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
  useDocumentTitle('Routines');
  const { data, error, reload } = usePolledData(
    'routines',
    () => getRoutines(sameOriginApi),
    getHasRunningRoutine,
  );

  return (
    <div>
      <PageHeader
        title="Routines"
        aside={data && <SectionAside>{data.length} routines</SectionAside>}
      />
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && (
        <Card className="gap-0 overflow-visible py-0">
          <RoutinesTable routines={data} onStarted={reload} />
        </Card>
      )}
    </div>
  );
}
