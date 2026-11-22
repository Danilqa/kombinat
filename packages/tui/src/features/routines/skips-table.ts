import type { Skip } from 'domains/scheduler/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { formatRelativeCompact, formatTimestamp } from 'utils/date-time';

import { columns, withStyle } from '../../components/columns';
import { toContent } from '../../page-content';
import type { ContentLine } from '../../page-content';
import { S, sanitize, text } from '../../terminal/text';

const MIN_OUTPUT_WIDTH = 12;

export function skipsTable(skips: Skip[], now: number, width: number): ContentLine[] {
  if (skips.length === 0) return [{ line: [text('Nothing skipped.', S.dim)] }];
  // What is left of the line after the other columns and their gaps, shown only when it fits.
  const outputWidth = width - 58;
  const hasCheckOutput =
    outputWidth >= MIN_OUTPUT_WIDTH && skips.some(skip => skip.checkOutput !== null);
  const header = withStyle(
    columns([
      { line: [text('SKIPPED')], width: 10 },
      { line: [text('SCHEDULED FOR')], width: 22 },
      { line: [text('REASON')], width: 20 },
      ...(hasCheckOutput ? [{ line: [text('CHECK OUTPUT')], width: outputWidth }] : []),
    ]),
    S.dim,
  );
  const rows = [...skips].reverse().map(skip =>
    columns([
      { line: [text(formatRelativeCompact(skip.at, now), S.cyan)], width: 10 },
      { line: [text(formatTimestamp(skip.scheduledFor))], width: 22 },
      { line: [text(getSkipReasonLabel(skip.reason), S.yellow)], width: 20 },
      ...(hasCheckOutput
        ? [
            {
              line: [text(sanitize(skip.checkOutput?.split('\n')[0] ?? ''), S.dim)],
              width: outputWidth,
            },
          ]
        : []),
    ]),
  );
  return toContent([header, ...rows]);
}
