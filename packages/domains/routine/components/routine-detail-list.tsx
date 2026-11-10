import { DetailList, RelativeTime, type DetailEntry } from 'design-system/components';

import type { RoutineSummary } from '../types';
import { getWebhookPath } from '../../webhook/utils';

function getStatEntries(routine: RoutineSummary): DetailEntry[] {
  return [
    { label: 'Next run', value: <RelativeTime iso={routine.nextRunAt} isFocusable /> },
    {
      label: 'Last run',
      value: <RelativeTime iso={routine.lastRun?.startedAt ?? null} isFocusable />,
    },
    { label: 'Timeout', value: `${routine.timeoutMinutes} min` },
    {
      label: 'Budget',
      value: routine.maxBudgetUsd === null ? 'None' : `$${routine.maxBudgetUsd.toFixed(2)}`,
    },
    { label: 'Working directory', value: routine.cwd, isMono: true, span: 'wide' },
    { label: 'File', value: routine.file, isMono: true, span: 'wide' },
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
}

export function RoutineDetailList({ routine }: RoutineDetailListProps) {
  return <DetailList entries={getStatEntries(routine)} />;
}
