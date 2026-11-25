import { DetailList, RelativeTime, type DetailEntry } from 'design-system/components';

import { getAccountLabel } from '../../agent/utils';
import { getBudgetLabel, getRetriesLabel, getRunCountLabel } from '../../run/utils';
import type { RoutineSummary } from '../types';
import { getWebhookPath } from '../../webhook/utils';

function getStatEntries(routine: RoutineSummary, hasAccount: boolean): DetailEntry[] {
  return [
    ...(hasAccount ? [{ label: 'Account', value: getAccountLabel(routine.account) }] : []),
    { label: 'Next run', value: <RelativeTime iso={routine.nextRunAt} isFocusable /> },
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
}

export function RoutineDetailList({ routine, hasAccount }: RoutineDetailListProps) {
  return <DetailList entries={getStatEntries(routine, hasAccount)} />;
}
