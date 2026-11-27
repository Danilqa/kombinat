import { Fragment } from 'react';
import { Link } from 'react-router';
import { DetailList, RelativeTime, type DetailEntry } from 'design-system';
import { getAccountLabel } from 'domains/agent/utils';
import type { RoutineName } from 'domains/routine/ids';
import type { ChainLink, RoutineSummary } from 'domains/routine/types';
import {
  getBudgetLabel,
  getChainConditionLabel,
  getRetriesLabel,
  getRunCountLabel,
} from 'domains/run/utils';
import type { ChainCondition } from 'domains/run/types';
import { getWebhookPath } from 'domains/webhook/utils';
import { getRoutinePath } from '@web-app/paths';

interface ChainedRoutineProps {
  name: RoutineName;
  condition: ChainCondition;
}

function ChainedRoutine({ name, condition }: ChainedRoutineProps) {
  return (
    <>
      <Link to={getRoutinePath(name)} className="underline-offset-4 hover:underline">
        {name}
      </Link>
      , {getChainConditionLabel(condition)}
    </>
  );
}

function getChainEntries(routine: RoutineSummary, nextRoutines: ChainLink[]): DetailEntry[] {
  const { startsAfter, startsWhen } = routine;
  return [
    ...(startsAfter === null || startsWhen === null
      ? []
      : [
          {
            label: 'Starts after',
            value: <ChainedRoutine name={startsAfter} condition={startsWhen} />,
            span: 'wide' as const,
          },
        ]),
    ...(nextRoutines.length === 0
      ? []
      : [
          {
            label: 'Then runs',
            value: nextRoutines.map(({ name, startsWhen }, index) => (
              <Fragment key={name}>
                {index > 0 && <br />}
                {startsWhen !== null && <ChainedRoutine name={name} condition={startsWhen} />}
              </Fragment>
            )),
            span: 'wide' as const,
          },
        ]),
  ];
}

function getStatEntries(
  routine: RoutineSummary,
  hasAccount: boolean,
  nextRoutines: ChainLink[],
): DetailEntry[] {
  return [
    ...(hasAccount ? [{ label: 'Account', value: getAccountLabel(routine.account) }] : []),
    { label: 'Next run', value: <RelativeTime iso={routine.nextRunAt} isFocusable /> },
    ...getChainEntries(routine, nextRoutines),
    {
      label: 'Last run',
      value: <RelativeTime iso={routine.lastRun?.startedAt ?? null} isFocusable />,
    },
    { label: 'Timeout', value: `${routine.timeoutMinutes} min` },
    ...(routine.retries === 0
      ? []
      : [{ label: 'Retries', value: getRetriesLabel(routine.retries) }]),
    ...(routine.runs === 1
      ? []
      : [{ label: 'Runs', value: getRunCountLabel(routine.runs, routine.maxParallel) }]),
    {
      label: 'Budget',
      value: getBudgetLabel(routine.maxBudgetUsd, routine.maxBudgetTokens) ?? 'None',
    },
    { label: 'Working directory', value: routine.cwd, isMono: true, span: 'wide' },
    ...(routine.worktree
      ? [
          {
            label: 'Worktree',
            value: `Each run gets its own, on a kombinat/${routine.name}-<run> branch`,
            span: 'wide' as const,
          },
        ]
      : []),
    { label: 'File', value: routine.file, isMono: true, span: 'wide' },
    ...(routine.check === null
      ? []
      : [{ label: 'Check', value: routine.check, isMono: true, span: 'full' as const }]),
    ...(routine.webhook
      ? [
          {
            label: 'Webhook',
            value: `POST ${getWebhookPath(routine.name)}`,
            isMono: true,
            span: 'wide' as const,
          },
        ]
      : []),
    ...(routine.webhookGate === null
      ? []
      : [
          {
            label: 'Webhook gate',
            value: routine.webhookGate,
            isMono: true,
            span: 'wide' as const,
          },
        ]),
    ...(routine.command === null
      ? []
      : [{ label: 'Command', value: routine.command, isMono: true, span: 'full' as const }]),
  ];
}

interface RoutineDetailListProps {
  routine: RoutineSummary;
  // Whether to name the login it runs on, which says nothing while every routine runs on one.
  hasAccount: boolean;
  // The routines that start after this one.
  nextRoutines: ChainLink[];
}

export function RoutineDetailList({ routine, hasAccount, nextRoutines }: RoutineDetailListProps) {
  return <DetailList entries={getStatEntries(routine, hasAccount, nextRoutines)} />;
}
