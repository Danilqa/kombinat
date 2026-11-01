import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DetailEntry = {
  label: string;
  value: ReactNode;
  isMono?: boolean;
  span?: DetailSpan;
};

type DetailSpan = 'single' | 'wide' | 'full';

type DetailLayout = 'rows' | 'grid';

const listClassNames: Record<DetailLayout, string> = {
  rows: 'grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2',
  grid: 'grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4',
};

const itemClassNames: Record<DetailLayout, string> = {
  rows: 'contents',
  grid: 'min-w-0 space-y-1',
};

const spanClassNames: Record<DetailLayout, Record<DetailSpan, string>> = {
  rows: { single: '', wide: '', full: '' },
  grid: { single: '', wide: 'col-span-2', full: 'col-span-2 md:col-span-4' },
};

const labelClassNames: Record<DetailLayout, string> = {
  rows: 'text-grey-60',
  grid: 'eyebrow',
};

export function DetailList({
  entries,
  layout = 'rows',
}: {
  entries: DetailEntry[];
  layout?: DetailLayout;
}) {
  return (
    <dl className={listClassNames[layout]}>
      {entries.map(entry => (
        <div
          key={entry.label}
          className={cn(itemClassNames[layout], spanClassNames[layout][entry.span ?? 'single'])}
        >
          <dt className={labelClassNames[layout]}>{entry.label}</dt>
          <dd
            className={cn(
              'min-w-0 break-all text-black',
              entry.isMono && 'font-mono text-paragraph-12',
            )}
          >
            {entry.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
