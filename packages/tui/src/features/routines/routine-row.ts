import type { RoutineSummary } from 'domains/routine/types';
import { formatRelativeCompact } from 'utils/date-time';

import { columns } from '../../components/columns';
import { spinner, statusIcon } from '../../components/run-status';
import { S, text } from '../../terminal/text';
import type { Line } from '../../terminal/text';
import { formatQueueLabel } from './queue-table';

export function routineRow(routine: RoutineSummary, width: number, now: number): Line {
  const icon = routine.running
    ? text(spinner(now), S.yellow)
    : routine.lastRun
      ? statusIcon(routine.lastRun.status, now)
      : text('·', S.dim);
  const next = !routine.enabled
    ? 'disabled'
    : routine.nextRunAt
      ? formatRelativeCompact(routine.nextRunAt, now)
      : 'manual';
  return [
    icon,
    text(' '),
    ...columns([
      {
        line: [
          text(routine.name, routine.running ? S.boldYellow : routine.enabled ? undefined : S.dim),
          ...(routine.queuedWebhooks > 0
            ? [text(`  ${formatQueueLabel(routine.queuedWebhooks)}`, S.yellow)]
            : []),
        ],
        width: Math.max(4, width - 13),
      },
      { line: [text(next, routine.nextRunAt ? S.cyan : S.dim)], width: 9, align: 'right' },
    ]),
  ];
}
