import { Link } from 'react-router';
import { EmptyState, RelativeTime, Table } from 'design-system/components';
import { cn } from 'design-system/utils';
import { RunStatusBadge } from 'domains/run/components';
import type { RunRecord } from 'domains/run/types';
import { getRunDurationMs, getTriggerLabel } from 'domains/run/utils';
import { formatDuration } from 'utils/date-time';
import { getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useRowLink } from '@web-app/hooks/use-row-link';

interface RunsTableProps {
  runs: RunRecord[];
  hasRoutineColumn: boolean;
}

export function RunsTable({ runs, hasRoutineColumn }: RunsTableProps) {
  const getRowClickHandler = useRowLink();
  if (runs.length === 0) return <EmptyState>No runs yet.</EmptyState>;
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          {hasRoutineColumn && <Table.Head>Routine</Table.Head>}
          <Table.Head>Status</Table.Head>
          <Table.Head>Run</Table.Head>
          <Table.Head className="max-sm:hidden">Trigger</Table.Head>
          <Table.Head>Started</Table.Head>
          <Table.Head className="text-right">Duration</Table.Head>
          <Table.Head className="text-right">Turns</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {runs.map(run => (
          <Table.Row
            key={`${run.routine}/${run.id}`}
            className="cursor-pointer"
            onClick={getRowClickHandler(getRunPath(run.routine, run.id))}
          >
            {hasRoutineColumn && (
              <Table.Cell>
                <Link
                  to={getRoutinePath(run.routine)}
                  className="text-body font-medium text-fg underline-offset-4 hover:underline"
                >
                  {run.routine}
                </Link>
              </Table.Cell>
            )}
            <Table.Cell>
              <RunStatusBadge status={run.status} />
            </Table.Cell>
            <Table.Cell>
              <Link
                to={getRunPath(run.routine, run.id)}
                className={cn(
                  'font-mono text-body-sm underline-offset-4 transition-colors hover:underline',
                  hasRoutineColumn ? 'text-fg-secondary hover:text-fg' : 'text-fg',
                )}
              >
                {run.id}
              </Link>
            </Table.Cell>
            <Table.Cell className="text-fg-secondary max-sm:hidden">
              {getTriggerLabel(run.trigger)}
            </Table.Cell>
            <Table.Cell className="text-fg-secondary">
              <RelativeTime iso={run.startedAt} />
            </Table.Cell>
            <Table.Cell className="text-right text-fg tabular-nums">
              {formatDuration(getRunDurationMs(run))}
            </Table.Cell>
            <Table.Cell className="text-right text-fg tabular-nums">
              {run.numTurns ?? '-'}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
