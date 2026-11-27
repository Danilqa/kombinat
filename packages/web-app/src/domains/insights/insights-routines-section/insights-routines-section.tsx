import { Link } from 'react-router';
import { Card, EmptyState, Table, SectionHeader, cn } from 'design-system';
import type { Insights, InsightsRoutine } from 'domains/insights/types';
import { formatTokens, formatTokenShare } from 'domains/run/utils';
import { formatDuration } from 'utils/date-time';
import { useRowLink } from '@web-app/hooks';
import { getRoutinePath } from '@web-app/paths';

interface ShareBarProps {
  share: number;
}

function ShareBar({ share }: ShareBarProps) {
  return (
    <div aria-hidden="true" className="mt-1.5 h-1 w-full max-w-48 rounded-full bg-line">
      <div
        className="h-full rounded-full bg-fg-faint"
        style={{ width: share === 0 ? 0 : `max(${share * 100}%, 2px)` }}
      />
    </div>
  );
}

interface RoutineRowProps {
  routine: InsightsRoutine;
}

function RoutineRow({ routine }: RoutineRowProps) {
  const getRowClickHandler = useRowLink();
  const path = getRoutinePath(routine.routine);
  return (
    <Table.Row className="cursor-pointer" onClick={getRowClickHandler(path)}>
      <Table.Cell className="w-full max-w-0">
        <Link
          to={path}
          className="block truncate font-medium underline-offset-4 hover:underline"
          title={routine.routine}
        >
          {routine.routine}
        </Link>
        <ShareBar share={routine.share} />
      </Table.Cell>
      <Table.Cell className="text-right tabular-nums">
        {routine.tokens === null ? '-' : formatTokens(routine.tokens)}
      </Table.Cell>
      <Table.Cell className="text-right text-fg-secondary tabular-nums max-sm:hidden">
        {routine.tokens === null ? '-' : formatTokenShare(routine.share)}
      </Table.Cell>
      <Table.Cell className="text-right tabular-nums">{routine.runs}</Table.Cell>
      <Table.Cell
        className={cn(
          'text-right tabular-nums',
          routine.failed > 0 ? 'text-negative' : 'text-fg-secondary',
        )}
      >
        {routine.failed}
      </Table.Cell>
      <Table.Cell className="text-right text-fg-secondary tabular-nums max-md:hidden">
        {formatDuration(routine.averageRunMs)}
      </Table.Cell>
    </Table.Row>
  );
}

interface InsightsRoutinesSectionProps {
  insights: Insights;
}

export function InsightsRoutinesSection({ insights }: InsightsRoutinesSectionProps) {
  const { routines, days } = insights;
  return (
    <section>
      <SectionHeader.Root>Routines by tokens</SectionHeader.Root>
      <Card.Root className="overflow-visible">
        {routines.length === 0 ? (
          <EmptyState>
            No runs in the last {days} days. Run a routine with Run now to see it here.
          </EmptyState>
        ) : (
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Routine</Table.Head>
                <Table.Head className="text-right">Tokens</Table.Head>
                <Table.Head className="text-right max-sm:hidden">Share</Table.Head>
                <Table.Head className="text-right">Runs</Table.Head>
                <Table.Head className="text-right">Failed</Table.Head>
                <Table.Head className="text-right max-md:hidden">Average run time</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {routines.map(routine => (
                <RoutineRow key={routine.routine} routine={routine} />
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card.Root>
    </section>
  );
}
