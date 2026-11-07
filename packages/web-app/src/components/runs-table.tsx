import { Link } from 'react-router';
import { RelativeTime } from 'design-system/components/relative-time';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'design-system/components/table';
import { cn } from 'design-system/utils';
import { RunStatusBadge } from 'domains/run/components';
import type { RunRecord } from 'domains/run/types';
import { getRunDurationMs, getTriggerLabel } from 'domains/run/utils';
import { formatDuration } from 'utils/date-time';
import { useRowLink } from '@web-app/hooks/use-row-link';

interface RunsTableProps {
  runs: RunRecord[];
  hasRoutineColumn: boolean;
}

export function RunsTable({ runs, hasRoutineColumn }: RunsTableProps) {
  const getRowClickHandler = useRowLink();
  if (runs.length === 0)
    return <p className="py-10 text-center text-body text-fg-muted">No runs yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {hasRoutineColumn && <TableHead>Routine</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Run</TableHead>
          <TableHead className="max-sm:hidden">Trigger</TableHead>
          <TableHead>Started</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead className="text-right">Turns</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map(run => (
          <TableRow
            key={`${run.routine}/${run.id}`}
            className="cursor-pointer"
            onClick={getRowClickHandler(
              `/runs/${encodeURIComponent(run.routine)}/${encodeURIComponent(run.id)}`,
            )}
          >
            {hasRoutineColumn && (
              <TableCell>
                <Link
                  to={`/routines/${encodeURIComponent(run.routine)}`}
                  className="text-body font-medium text-fg underline-offset-4 hover:underline"
                >
                  {run.routine}
                </Link>
              </TableCell>
            )}
            <TableCell>
              <RunStatusBadge status={run.status} />
            </TableCell>
            <TableCell>
              <Link
                to={`/runs/${encodeURIComponent(run.routine)}/${encodeURIComponent(run.id)}`}
                className={cn(
                  'font-mono text-body-sm underline-offset-4 transition-colors hover:underline',
                  hasRoutineColumn ? 'text-fg-secondary hover:text-fg' : 'text-fg',
                )}
              >
                {run.id}
              </Link>
            </TableCell>
            <TableCell className="text-fg-secondary max-sm:hidden">
              {getTriggerLabel(run.trigger)}
            </TableCell>
            <TableCell className="text-fg-secondary">
              <RelativeTime iso={run.startedAt} />
            </TableCell>
            <TableCell className="text-right text-fg tabular-nums">
              {formatDuration(getRunDurationMs(run))}
            </TableCell>
            <TableCell className="text-right text-fg tabular-nums">{run.numTurns ?? '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
