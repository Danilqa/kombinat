import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  RelativeTime,
  Table,
} from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { cn } from 'design-system/utils';
import { RunNowButton, WebhookQueueButton } from 'domains/routine/components';
import { getRoutines } from 'domains/routine/requests';
import type { RoutineSummary } from 'domains/routine/types';
import { RunStatusBadge } from 'domains/run/components';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useRowLink } from '@web-app/hooks/use-row-link';

function checkHasRunningRoutine(routines: RoutineSummary[] = []): boolean {
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
          to={getRunPath(lastRun.routine, lastRun.id)}
          className="flex flex-col items-start gap-1"
        >
          <RunStatusBadge status={lastRun.status} />
          <span className="text-body-sm text-fg-muted tabular-nums">
            <RelativeTime iso={lastRun.startedAt} />
          </span>
        </Link>
      ) : (
        <span className="text-fg-muted">Never run</span>
      )}
      <WebhookQueueButton routine={routine.name} count={routine.queuedWebhooks} look="inline" />
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
}

function RoutinesTable({ routines }: RoutinesTableProps) {
  const getRowClickHandler = useRowLink();
  if (routines.length === 0) return <EmptyState>No routines yet.</EmptyState>;
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Routine</Table.Head>
          <Table.Head className="max-md:hidden">Description</Table.Head>
          <Table.Head>Schedule</Table.Head>
          <Table.Head>Next run</Table.Head>
          <Table.Head>Agent</Table.Head>
          <Table.Head>Last run</Table.Head>
          <Table.Head className="w-0">
            <span className="sr-only">Actions</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {routines.map(routine => (
          <Table.Row
            key={routine.name}
            className="cursor-pointer"
            onClick={getRowClickHandler(getRoutinePath(routine.name))}
          >
            <Table.Cell className="max-sm:whitespace-normal">
              <div className="flex items-center gap-2">
                <Link
                  to={getRoutinePath(routine.name)}
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
            </Table.Cell>
            <Table.Cell className="w-full min-w-48 whitespace-normal text-fg-secondary max-md:hidden">
              <div className="line-clamp-2" title={routine.description}>
                {routine.description}
              </div>
            </Table.Cell>
            <Table.Cell className="min-w-36 whitespace-normal max-sm:min-w-56">
              <div className="text-fg">{routine.scheduleHuman}</div>
              {routine.schedule && (
                <div className="font-mono text-body-sm whitespace-nowrap text-fg-muted">
                  {routine.schedule}
                </div>
              )}
            </Table.Cell>
            <Table.Cell className="text-fg-secondary tabular-nums">
              <RelativeTime iso={routine.nextRunAt} />
            </Table.Cell>
            <Table.Cell>
              <div
                className="max-w-44 truncate font-mono text-body-sm text-fg"
                title={routine.model ?? routine.command ?? routine.agent}
              >
                {routine.model ?? routine.command ?? routine.agent}
              </div>
              <div className="text-body-sm text-fg-muted">
                {routine.agent}
                {routine.effort !== null && ` · effort ${routine.effort}`}
              </div>
            </Table.Cell>
            <Table.Cell>
              <LastRunCell routine={routine} />
            </Table.Cell>
            <Table.Cell>
              <RunNowButton
                routine={routine.name}
                isRunning={routine.running}
                variant="secondary"
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export function RoutinesPage() {
  useDocumentTitle('Routines');
  const { data, error, isPending } = useQuery({
    queryKey: ['routines'],
    queryFn: () => getRoutines(sameOriginApi),
    refetchInterval: query => getPollInterval(checkHasRunningRoutine(query.state.data)),
  });

  return (
    <div>
      <PageHeader.Root
        title="Routines"
        aside={data && <PageHeader.Aside>{data.length} routines</PageHeader.Aside>}
      />
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <Card.Root className="gap-0 overflow-visible py-0">
          <RoutinesTable routines={data} />
        </Card.Root>
      )}
    </div>
  );
}
