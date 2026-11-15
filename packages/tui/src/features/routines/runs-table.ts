import type { RoutineName } from 'domains/routine/ids';
import type { RunsPage } from 'domains/run/types';
import { getRunDurationMs, getTriggerLabel } from 'domains/run/utils';
import { formatDuration, formatRelativeCompact } from 'utils/date-time';

import { columns, withStyle } from '../../components/columns';
import type { Column } from '../../components/columns';
import { statusBadge, statusIcon } from '../../components/run-status';
import type { ContentLine } from '../../page-content';
import { S, text } from '../../terminal/text';
import type { Line } from '../../terminal/text';

export function runsTable(
  routine: RoutineName,
  { runs, total }: RunsPage,
  width: number,
  now: number,
): ContentLine[] {
  if (runs.length === 0) return [{ line: [text('No runs yet.', S.dim)] }];
  const isWide = width >= 78;
  const header: Column[] = isWide
    ? [
        { line: [text('STATUS')], width: 12 },
        { line: [text('RUN')], width: 22 },
        { line: [text('TRIGGER')], width: 9 },
        { line: [text('STARTED')], width: 10, align: 'right' },
        { line: [text('DURATION')], width: 8, align: 'right' },
        { line: [text('TURNS')], width: 5, align: 'right' },
      ]
    : [
        { line: [text(' ')], width: 1 },
        { line: [text('RUN')], width: Math.max(8, width - 24) },
        { line: [text('STARTED')], width: 10, align: 'right' },
        { line: [text('TIME')], width: 7, align: 'right' },
      ];
  const headerLine = withStyle(columns(header), S.dim);
  const rows = runs.map((run): ContentLine => {
    const started: Line = [text(formatRelativeCompact(run.startedAt, now), S.cyan)];
    const duration: Line = [text(formatDuration(getRunDurationMs(run, now)), S.magenta)];
    const cells: Column[] = isWide
      ? [
          { line: statusBadge(run.status, now), width: 12 },
          { line: [text(run.id)], width: 22 },
          { line: [text(getTriggerLabel(run.trigger), S.dim)], width: 9 },
          { line: started, width: 10, align: 'right' },
          { line: duration, width: 8, align: 'right' },
          { line: [text(String(run.numTurns ?? '-'))], width: 5, align: 'right' },
        ]
      : [
          { line: [statusIcon(run.status, now)], width: 1 },
          { line: [text(run.id)], width: Math.max(8, width - 24) },
          { line: started, width: 10, align: 'right' },
          { line: duration, width: 7, align: 'right' },
        ];
    return { line: columns(cells), action: { kind: 'open-run', routine, id: run.id } };
  });
  const more = total - runs.length;
  return [
    { line: headerLine },
    ...rows,
    ...(more > 0 ? [{ line: [text(`${more} more…`, S.dim)] }] : []),
  ];
}
