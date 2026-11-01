import { Link } from 'react-router';
import { RelativeTime } from '@/components/relative-time';
import { StatusBadge, getTriggerLabel } from '@/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RunRecord } from '@/lib/api';
import { formatDuration, getRunDurationMs } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RunsTableProps {
  runs: RunRecord[];
  hasRoutineColumn: boolean;
}

export function RunsTable({ runs, hasRoutineColumn }: RunsTableProps) {
  if (runs.length === 0)
    return <p className="py-10 text-center text-body text-fg-muted">No runs yet.</p>;
  // The run link covers the whole row; the routine link and the time sit above it.
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
          <TableRow key={`${run.routine}/${run.id}`} className="relative">
            {hasRoutineColumn && (
              <TableCell>
                <Link
                  to={`/routines/${encodeURIComponent(run.routine)}`}
                  className="relative z-10 text-body font-medium text-fg underline-offset-4 hover:underline"
                >
                  {run.routine}
                </Link>
              </TableCell>
            )}
            <TableCell>
              <StatusBadge status={run.status} />
            </TableCell>
            <TableCell>
              <Link
                to={`/runs/${encodeURIComponent(run.routine)}/${encodeURIComponent(run.id)}`}
                className={cn(
                  "font-mono text-body-sm underline-offset-4 transition-colors after:absolute after:inset-0 after:content-[''] hover:underline",
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
              <RelativeTime iso={run.startedAt} className="relative z-10" />
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
