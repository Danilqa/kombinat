import type { Skip } from 'domains/scheduler/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { formatRelativeCompact, formatTimestamp } from 'utils/date-time';

import { columns, withStyle } from '../../components/columns';
import { toContent } from '../../page-content';
import type { ContentLine } from '../../page-content';
import { S, text } from '../../terminal/text';

export function skipsTable(skips: Skip[], now: number): ContentLine[] {
  if (skips.length === 0) return [{ line: [text('Nothing skipped.', S.dim)] }];
  const header = withStyle(
    columns([
      { line: [text('SKIPPED')], width: 10 },
      { line: [text('SCHEDULED FOR')], width: 22 },
      { line: [text('REASON')], width: 20 },
    ]),
    S.dim,
  );
  const rows = [...skips].reverse().map(skip =>
    columns([
      { line: [text(formatRelativeCompact(skip.at, now), S.cyan)], width: 10 },
      { line: [text(formatTimestamp(skip.scheduledFor))], width: 22 },
      { line: [text(getSkipReasonLabel(skip.reason), S.yellow)], width: 20 },
    ]),
  );
  return toContent([header, ...rows]);
}
