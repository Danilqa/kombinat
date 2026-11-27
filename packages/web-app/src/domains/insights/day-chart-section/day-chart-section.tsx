import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Card, SectionHeader, cn, DayBar, type DayBarSegment } from 'design-system';
import { parseLocalDate } from 'domains/run/utils';
import { formatDayMonth, formatWeekday } from 'utils/date-time';

export interface DayChartBar {
  date: string;
  segments: DayBarSegment[];
  summary: string;
}

// A week names each day under its bar. A month is too narrow for that on a phone.
const MAX_CAPTIONED_DAYS = 7;

// A month of bars would be 30 tab stops, so the arrow keys move between them instead.
function getNextIndex(key: string, index: number, count: number): number | null {
  if (key === 'ArrowLeft') return Math.max(0, index - 1);
  if (key === 'ArrowRight') return Math.min(count - 1, index + 1);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

interface DayChartSectionProps {
  title: string;
  aside: ReactNode;
  bars: DayChartBar[];
}

export function DayChartSection({ title, aside, bars }: DayChartSectionProps) {
  const maxTotal = Math.max(
    ...bars.map(bar => bar.segments.reduce((sum, segment) => sum + segment.value, 0)),
  );
  const hasCaptions = bars.length <= MAX_CAPTIONED_DAYS;
  const [first] = bars;
  const [focusedIndex, setFocusedIndex] = useState(bars.length - 1);

  function moveFocus(event: KeyboardEvent<HTMLOListElement>) {
    const next = getNextIndex(event.key, focusedIndex, bars.length);
    if (next === null) return;
    event.preventDefault();
    setFocusedIndex(next);
    event.currentTarget.querySelectorAll<HTMLElement>('[role=img]')[next]?.focus();
  }

  return (
    <section>
      <SectionHeader.Root aside={aside}>{title}</SectionHeader.Root>
      <Card.Root className="gap-1.5 p-4">
        <ol
          aria-label={title}
          className={cn('flex', hasCaptions ? 'gap-1.5 sm:gap-2' : 'gap-0.5')}
          onKeyDown={moveFocus}
        >
          {bars.map((bar, index) => {
            const date = parseLocalDate(bar.date);
            return (
              <DayBar
                key={bar.date}
                label={`${formatWeekday(date)} ${formatDayMonth(date)}: ${bar.summary}`}
                segments={bar.segments}
                maxTotal={maxTotal}
                caption={hasCaptions ? formatWeekday(date) : null}
                className="h-32"
                tabIndex={index === focusedIndex ? 0 : -1}
              />
            );
          })}
        </ol>
        {!hasCaptions && first && (
          <div aria-hidden="true" className="flex justify-between text-body-sm text-fg-muted">
            <span>{formatDayMonth(parseLocalDate(first.date))}</span>
            <span>Today</span>
          </div>
        )}
      </Card.Root>
    </section>
  );
}
