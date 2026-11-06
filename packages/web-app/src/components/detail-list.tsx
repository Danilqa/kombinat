import type { ReactNode } from 'react';
import { cn } from '@web-app/lib/utils';

export interface DetailEntry {
  label: string;
  value: ReactNode;
  isMono?: boolean;
  span?: DetailSpan;
}

type DetailSpan = 'single' | 'wide' | 'full';

type GridSize = 'base' | 'md';

const gridColumnCounts: Record<GridSize, number> = { base: 2, md: 4 };

const spanWidths: Record<DetailSpan, Record<GridSize, number>> = {
  single: { base: 1, md: 1 },
  wide: { base: 2, md: 2 },
  full: { base: 2, md: 4 },
};

const columnSpanClassNames: Record<GridSize, Record<number, string>> = {
  base: { 1: 'col-span-1', 2: 'col-span-2' },
  md: { 1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4' },
};

function getTotal(widths: number[]): number {
  return widths.reduce((total, width) => total + width, 0);
}

function getFilledWidths(entries: DetailEntry[], size: GridSize): number[] {
  const columnCount = gridColumnCounts[size];
  const rows: number[][] = [];
  for (const entry of entries) {
    const width = spanWidths[entry.span ?? 'single'][size];
    const row = rows.at(-1);
    if (row !== undefined && getTotal(row) + width <= columnCount) row.push(width);
    else rows.push([width]);
  }
  return rows.flatMap(row =>
    row.map((width, index) =>
      index === row.length - 1 ? width + columnCount - getTotal(row) : width,
    ),
  );
}

function getColumnSpanClassNames(entries: DetailEntry[]): string[] {
  const baseWidths = getFilledWidths(entries, 'base');
  const mdWidths = getFilledWidths(entries, 'md');
  return entries.map((_, index) =>
    cn(
      columnSpanClassNames.base[baseWidths[index] ?? 1],
      columnSpanClassNames.md[mdWidths[index] ?? 1],
    ),
  );
}

function getValueClassName(entry: DetailEntry): string {
  return entry.isMono ? 'font-mono text-body-sm break-all' : 'break-words';
}

interface DetailListProps {
  entries: DetailEntry[];
}

export function DetailList({ entries }: DetailListProps) {
  const spanClassNames = getColumnSpanClassNames(entries);
  return (
    <div className="overflow-hidden">
      <dl className="-mt-px -ml-px grid grid-cols-2 md:grid-cols-4">
        {entries.map((entry, index) => (
          <div
            key={entry.label}
            className={cn(
              'flex min-w-0 flex-col gap-1 border-t border-l border-line-faint px-4 py-3',
              spanClassNames[index],
            )}
          >
            <dt className="text-body-sm text-fg-muted">{entry.label}</dt>
            <dd className={cn('min-w-0 text-body text-fg tabular-nums', getValueClassName(entry))}>
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
