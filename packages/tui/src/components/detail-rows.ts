import { formatRelativeCompact, formatTimestamp } from 'utils/date-time';

import { fitLine, S, text, wrapLine } from '../terminal/text';
import type { Line, Span } from '../terminal/text';

export interface DetailPair {
  label: string;
  value: Line;
  isWide?: boolean;
}

export function detailRows(pairs: DetailPair[], width: number): Line[] {
  const labelWidth = 10;
  const isTwoColumn = width >= 96;
  const half = Math.floor(width / 2);
  const rows: Line[] = [];
  const label = (value: string): Span => text(value.padEnd(labelWidth), S.dim);
  const queue = [...pairs];
  for (let pair = queue.shift(); pair !== undefined; pair = queue.shift()) {
    const next = queue[0];
    if (isTwoColumn && pair.isWide !== true && next !== undefined && next.isWide !== true) {
      rows.push([
        ...fitLine([label(pair.label), ...pair.value], half),
        ...fitLine([label(next.label), ...next.value], width - half),
      ]);
      queue.shift();
      continue;
    }
    const [first = [], ...rest] = wrapLine(pair.value, width - labelWidth);
    rows.push(
      [label(pair.label), ...first],
      ...rest.map(line => [text(' '.repeat(labelWidth)), ...line]),
    );
  }
  return rows;
}

export function timeValue(iso: string | null, now: number): Line {
  if (!iso) return [text('-', S.dim)];
  return [text(formatTimestamp(iso)), text(` · ${formatRelativeCompact(iso, now)}`, S.cyan)];
}
