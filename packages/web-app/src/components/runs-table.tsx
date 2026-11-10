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
    <Table.VirtualRoot
      className="min-w-[760px]"
      data={runs}
      header={
        <Table.Row>
          {hasRoutineColumn && <Table.Head>Routine</Table.Head>}
          <Table.Head className="w-[16%]">Status</Table.Head>
          <Table.Head className="w-[25%]">Run</Table.Head>
          <Table.Head className="w-[12%] max-sm:hidden">Trigger</Table.Head>
          <Table.Head className="w-[13%]">Started</Table.Head>
          <Table.Head className="w-[11%] text-right">Duration</Table.Head>
          <Table.Head className="w-[8%] text-right">Turns</Table.Head>
        </Table.Row>
      }
      computeItemKey={run => `${run.routine}/${run.id}`}
      getRowProps={run => ({
        className: 'cursor-pointer',
        onClick: getRowClickHandler(getRunPath(run.routine, run.id)),
      })}
      renderCells={run => (
        <>
          {hasRoutineColumn && (
            <Table.Cell className="truncate">
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
          <Table.Cell className="text-right text-fg tabular-nums">{run.numTurns ?? '-'}</Table.Cell>
        </>
      )}
    />
  );
}
