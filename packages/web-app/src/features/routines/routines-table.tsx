import { UserRound, Webhook } from 'lucide-react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, EmptyState, RelativeTime, Table, Tooltip } from 'design-system/components';
import { cn } from 'design-system/utils';
import { checkHasAccount, getAccountLabel, listAccounts } from 'domains/agent/utils';
import { getDaemonStatus } from 'domains/daemon/requests';
import { RunNowButton, WebhookQueueButton } from 'domains/routine/components';
import type { RoutineSummary } from 'domains/routine/types';
import { RunStatusBadge } from 'domains/run/components';
import type { TokenUsage } from 'domains/run/types';
import { formatTokens, getTokenTotal } from 'domains/run/utils';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { sameOriginApi } from 'utils/http';
import { getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useRowLink } from '@web-app/hooks/use-row-link';
import { ChangePromptMenuItem } from './change-prompt-menu-item';

interface ScheduleCellProps {
  routine: RoutineSummary;
}

function ScheduleCell({ routine }: ScheduleCellProps) {
  const webhookLabel = routine.schedule ? 'Also runs on webhook' : 'Runs on webhook';
  return (
    <div className="text-fg">
      {routine.schedule ? (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <span>{routine.scheduleHuman}</span>
          </Tooltip.Trigger>
          <Tooltip.Content className="font-mono">{routine.schedule}</Tooltip.Content>
        </Tooltip.Root>
      ) : (
        routine.scheduleHuman
      )}
      {routine.webhook && (
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <span
              role="img"
              aria-label={webhookLabel}
              className="ml-1.5 inline-flex cursor-default align-[-2px] text-fg-muted"
            >
              <Webhook aria-hidden="true" className="size-3.5" />
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content>{webhookLabel}</Tooltip.Content>
        </Tooltip.Root>
      )}
    </div>
  );
}

interface AgentCellProps {
  routine: RoutineSummary;
  hasSeveralAccounts: boolean;
}

function AgentCell({ routine, hasSeveralAccounts }: AgentCellProps) {
  const account = getAccountLabel(routine.account);
  return (
    <>
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
      {/* One login needs no label, so the account shows once routines run on more than one. */}
      {hasSeveralAccounts && checkHasAccount(routine.agent) && (
        <Badge
          size="small"
          variant="ghost"
          className="mt-1 max-w-44"
          title={`Runs on the ${account} account`}
        >
          <UserRound aria-hidden="true" />
          <span className="sr-only">Account </span>
          <span className="truncate">{account}</span>
        </Badge>
      )}
    </>
  );
}

interface LastRunCellProps {
  routine: RoutineSummary;
}

function LastRunCell({ routine }: LastRunCellProps) {
  const { lastRun, lastSkip } = routine;
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5">
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
        <WebhookQueueButton routine={routine.name} count={routine.queuedWebhooks} look="chip" />
      </div>
      {lastSkip && (
        <div className="text-body-sm text-fg-muted">
          Skipped <RelativeTime iso={lastSkip.at} /> ({getSkipReasonLabel(lastSkip.reason)})
        </div>
      )}
    </div>
  );
}

interface RoutineTokensProps {
  usage: TokenUsage;
  maxTotal: number;
}

// A line under the name, since the table has no room for another column beside Run now.
function RoutineTokens({ usage, maxTotal }: RoutineTokensProps) {
  const total = getTokenTotal(usage.counts);
  const isTop = total > 0 && total === maxTotal;
  return (
    <div className="text-body-sm text-fg-muted tabular-nums">
      <span className={cn(isTop && 'text-warning')}>{formatTokens(total)}</span> tokens in 7 days
      {isTop && <span className="sr-only">, the most of all routines</span>}
    </div>
  );
}

function NoRoutinesState() {
  const { data } = useQuery({
    queryKey: ['status'],
    queryFn: () => getDaemonStatus(sameOriginApi),
  });
  return (
    <EmptyState>
      No routines yet. Add a markdown file to{' '}
      <code className="font-mono">{data?.routinesDir ?? 'routines/'}</code> to create one.
    </EmptyState>
  );
}

interface RoutinesTableProps {
  routines: RoutineSummary[];
}

export function RoutinesTable({ routines }: RoutinesTableProps) {
  const getRowClickHandler = useRowLink();
  if (routines.length === 0) return <NoRoutinesState />;
  const hasSeveralAccounts = listAccounts(routines).length > 1;
  const maxTokenTotal = Math.max(
    0,
    ...routines.map(({ tokenUsage }) => (tokenUsage ? getTokenTotal(tokenUsage.counts) : 0)),
  );
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
            <Table.Cell className="max-sm:min-w-44 max-sm:whitespace-normal">
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
              {routine.tokenUsage && (
                <RoutineTokens usage={routine.tokenUsage} maxTotal={maxTokenTotal} />
              )}
            </Table.Cell>
            <Table.Cell className="w-full min-w-48 whitespace-normal text-fg-secondary max-md:hidden">
              <div className="line-clamp-2" title={routine.description}>
                {routine.description}
              </div>
            </Table.Cell>
            <Table.Cell className="min-w-36 whitespace-normal max-sm:min-w-56">
              <ScheduleCell routine={routine} />
            </Table.Cell>
            <Table.Cell className="text-fg-secondary tabular-nums">
              <RelativeTime iso={routine.nextRunAt} />
            </Table.Cell>
            <Table.Cell>
              <AgentCell routine={routine} hasSeveralAccounts={hasSeveralAccounts} />
            </Table.Cell>
            <Table.Cell>
              <LastRunCell routine={routine} />
            </Table.Cell>
            <Table.Cell>
              <RunNowButton
                routine={routine.name}
                runs={routine.runs}
                isRunning={routine.running}
                variant="secondary"
                menu={<ChangePromptMenuItem routine={routine.name} />}
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
