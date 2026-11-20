import { Link } from 'react-router';
import { EmptyState, RelativeTime, Table } from 'design-system/components';
import { cn } from 'design-system/utils';
import { RunDuration, RunStatusBadge } from 'domains/run/components';
import type { RunRecord } from 'domains/run/types';
import { formatTokens, getTokenTotal, getTriggerLabel } from 'domains/run/utils';
import { formatDayTime } from 'utils/date-time';
import { getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useRowLink } from '@web-app/hooks/use-row-link';

interface RunsTableProps {
  runs: RunRecord[];
  total: number;
  hasRoutineColumn: boolean;
  onEndReached: () => void;
}

export function RunsTable({ runs, total, hasRoutineColumn, onEndReached }: RunsTableProps) {
  const getRowClickHandler = useRowLink();
  if (runs.length === 0) {
    return <EmptyState>No runs yet. They show up here as soon as they start.</EmptyState>;
  }
  return (
    <Table.VirtualRoot
      className="min-w-[760px]"
      data={runs}
      totalCount={total}
      onEndReached={onEndReached}
      header={
        <Table.Row>
          {hasRoutineColumn && <Table.Head>Routine</Table.Head>}
          {/* Room for the longest status, Waiting for limit, beside the routine on a phone. */}
          <Table.Head className={cn('w-[16%]', hasRoutineColumn && 'max-sm:w-[20%]')}>
            Status
          </Table.Head>
          <Table.Head className="w-[25%]">Run</Table.Head>
          <Table.Head className="w-[12%] max-sm:hidden">Trigger</Table.Head>
          <Table.Head className="w-[13%] max-sm:w-[16%]">Started</Table.Head>
          <Table.Head className="w-[11%] text-right">Duration</Table.Head>
          <Table.Head className="w-[8%] text-right">Turns</Table.Head>
          {/* Only in the room a routine's own runs leave without the routine column. */}
          {!hasRoutineColumn && (
            <Table.Head className="w-[15%] text-right max-sm:hidden">Tokens</Table.Head>
          )}
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
                title={run.routine}
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
            <RelativeTime iso={run.startedAt} className="block w-fit" />
            <span aria-hidden="true" className="block text-body-sm text-fg-muted tabular-nums">
              {formatDayTime(run.startedAt)}
            </span>
          </Table.Cell>
          <Table.Cell className="text-right text-fg tabular-nums">
            <RunDuration run={run} />
          </Table.Cell>
          <Table.Cell className="text-right text-fg tabular-nums">{run.numTurns ?? '-'}</Table.Cell>
          {!hasRoutineColumn && (
            <Table.Cell className="text-right text-fg tabular-nums max-sm:hidden">
              {run.tokens === null ? '-' : formatTokens(getTokenTotal(run.tokens))}
            </Table.Cell>
          )}
        </>
      )}
    />
  );
}
