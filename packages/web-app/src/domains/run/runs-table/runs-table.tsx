import { Link } from 'react-router';
import { EmptyState, RelativeTime, Table, cn } from 'design-system';
import type { RunRecord } from 'domains/run/types';
import { formatTokens, getTokenTotal, getTriggerLabel } from 'domains/run/utils';
import { formatDayTime } from 'utils/date-time';
import { useRowLink } from '@web-app/hooks/use-row-link';
import { getRoutinePath, getRunPath } from '@web-app/paths';
import { BlockedBadge } from '../blocked-badge';
import { RunDuration } from '../run-duration';
import { RunStatusBadge } from '../run-status-badge';

interface RunsTableProps {
  runs: RunRecord[];
  total: number;
  hasRoutineColumn: boolean;
  onEndReached: () => void;
}

interface ColumnWidths {
  table: string;
  routine: string;
  status: string;
  run: string;
  trigger: string;
  started: string;
  duration: string;
  turns: string;
  tokens: string;
}

// Phones give every column a share. The min width grows by the Tokens column's, which keeps the others as wide as before.
const ALL_RUNS_WIDTHS: ColumnWidths = {
  table: 'min-w-210',
  routine: 'max-sm:w-[20%]',
  // Room for the longest status, Waiting for limit, beside the routine on a phone.
  status: 'w-[16%] max-sm:w-[20%]',
  run: 'w-[21%] max-sm:w-[25%]',
  trigger: 'w-[10%]',
  started: 'w-[13%] max-sm:w-[16%]',
  duration: 'w-[9%] max-sm:w-[11%]',
  turns: 'w-[7%] max-sm:w-[8%]',
  tokens: 'w-[9%] max-sm:w-[10.5%]',
};

const ROUTINE_RUNS_WIDTHS: ColumnWidths = {
  table: 'min-w-210 sm:min-w-190',
  routine: '',
  status: 'w-[16%]',
  run: 'w-[25%]',
  trigger: 'w-[12%]',
  started: 'w-[13%] max-sm:w-[16%]',
  duration: 'w-[11%]',
  turns: 'w-[8%]',
  tokens: 'w-[15%] max-sm:w-[8%]',
};

export function RunsTable({ runs, total, hasRoutineColumn, onEndReached }: RunsTableProps) {
  const getRowClickHandler = useRowLink();
  if (runs.length === 0) {
    return <EmptyState>No runs yet. They show up here as soon as they start.</EmptyState>;
  }
  const widths = hasRoutineColumn ? ALL_RUNS_WIDTHS : ROUTINE_RUNS_WIDTHS;
  return (
    <Table.VirtualRoot
      className={widths.table}
      data={runs}
      totalCount={total}
      onEndReached={onEndReached}
      header={
        <Table.Row>
          {hasRoutineColumn && <Table.Head className={widths.routine}>Routine</Table.Head>}
          <Table.Head className={widths.status}>Status</Table.Head>
          <Table.Head className={widths.run}>Run</Table.Head>
          <Table.Head className={cn(widths.trigger, 'max-sm:hidden')}>Trigger</Table.Head>
          <Table.Head className={widths.started}>Started</Table.Head>
          <Table.Head className={cn(widths.duration, 'text-right')}>Duration</Table.Head>
          <Table.Head className={cn(widths.turns, 'text-right')}>Turns</Table.Head>
          <Table.Head className={cn(widths.tokens, 'text-right')}>Tokens</Table.Head>
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
            <span className="flex flex-col items-start gap-1">
              <RunStatusBadge status={run.status} />
              {run.blockedActions.length > 0 && <BlockedBadge count={run.blockedActions.length} />}
            </span>
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
          <Table.Cell className="text-right text-fg tabular-nums">
            {run.tokens === null ? '-' : formatTokens(getTokenTotal(run.tokens))}
          </Table.Cell>
        </>
      )}
    />
  );
}
