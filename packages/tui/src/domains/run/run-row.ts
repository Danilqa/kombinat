import type { RunRecord } from 'domains/run/types';
import { getRunDurationMs } from 'domains/run/utils';
import { formatDuration, formatRelativeCompact } from 'utils/date-time';

import { columns } from '../../terminal/columns';
import { S, text } from '../../terminal/text';
import type { Line } from '../../terminal/text';
import { statusIcon } from './run-status';

export function runRow(run: RunRecord, width: number, now: number): Line {
  return [
    statusIcon(run.status, now),
    text(' '),
    ...columns(
      [
        { line: [text(run.routine)], width: Math.max(4, width - 21) },
        {
          line: [text(formatRelativeCompact(run.startedAt, now), S.cyan)],
          width: 10,
          align: 'right',
        },
        {
          line: [text(formatDuration(getRunDurationMs(run, now)), S.magenta)],
          width: 7,
          align: 'right',
        },
      ],
      1,
    ),
  ];
}
