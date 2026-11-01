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

type RunsTableProps = {
  runs: RunRecord[];
  hasRoutineColumn: boolean;
};

export function RunsTable({ runs, hasRoutineColumn }: RunsTableProps) {
  if (runs.length === 0)
    return <p className="py-8 text-center text-paragraph-14 text-grey-60">No runs yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {hasRoutineColumn && <TableHead>Routine</TableHead>}
          <TableHead>Run</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Started</TableHead>
          <TableHead className="text-right">Duration</TableHead>
          <TableHead className="text-right">Turns</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map(run => (
          <TableRow key={`${run.routine}/${run.id}`}>
            {hasRoutineColumn && (
              <TableCell>
                <Link
                  to={`/routines/${encodeURIComponent(run.routine)}`}
                  className="text-title-14 text-black hover:underline"
                >
                  {run.routine}
                </Link>
              </TableCell>
            )}
            <TableCell>
              <Link
                to={`/runs/${encodeURIComponent(run.routine)}/${encodeURIComponent(run.id)}`}
                className="font-mono text-paragraph-12 text-black hover:underline"
              >
                {run.id}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={run.status} />
            </TableCell>
            <TableCell className="text-grey-70">{getTriggerLabel(run.trigger)}</TableCell>
            <TableCell>
              <RelativeTime iso={run.startedAt} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatDuration(getRunDurationMs(run))}
            </TableCell>
            <TableCell className="text-right tabular-nums">{run.numTurns ?? '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
