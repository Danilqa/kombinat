import { memo, useMemo } from 'react';
import { cn } from 'design-system';
import type { CalendarEntryId } from 'domains/calendar/ids';
import type { CalendarEntry } from 'domains/calendar/types';
import { getCalendarEntryOverlapLabel } from 'domains/calendar/utils';
import type { RoutineName } from 'domains/routine/ids';
import { CalendarBlock } from './calendar-block';
import {
  checkIsSameDay,
  checkIsWeekend,
  getLengthForMinutes,
  getMinutesIntoDay,
  layoutDay,
} from './calendar-layout';

interface CurrentTimeLineProps {
  now: Date;
  dayStart: Date;
}

function CurrentTimeLine({ now, dayStart }: CurrentTimeLineProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-5 h-0.5 bg-warning"
      style={{ top: `calc(${getLengthForMinutes(getMinutesIntoDay(now, dayStart))} - 1px)` }}
    >
      <span className="absolute -top-0.75 left-0 size-2 rounded-full bg-warning" />
    </div>
  );
}

interface DayColumnProps {
  dayTime: number;
  entries: CalendarEntry[];
  now: Date | null;
  routinesById: Map<CalendarEntryId, RoutineName> | null;
}

// A day gets the time only when it is today, so the other days keep their blocks as the clock ticks.
const DayColumn = memo(function DayColumn({ dayTime, entries, now, routinesById }: DayColumnProps) {
  const day = new Date(dayTime);
  const positioned = useMemo(() => layoutDay(entries, new Date(dayTime)), [entries, dayTime]);
  return (
    <div
      className={cn('relative border-l border-line-faint', checkIsWeekend(day) && 'bg-hover')}
      style={{
        backgroundImage: `linear-gradient(to bottom, var(--line-faint) 1px, transparent 1px)`,
        backgroundSize: '100% var(--hour-height)',
      }}
    >
      {/* One fade per day when its runs arrive, not hundreds of block fades at once. */}
      {positioned.length > 0 && (
        <div className="absolute inset-0 z-10 animate-in duration-150 ease-out-quint fade-in">
          {positioned.map(item => (
            <CalendarBlock
              key={item.entry.id}
              positioned={item}
              overlapLabel={routinesById && getCalendarEntryOverlapLabel(item.entry, routinesById)}
            />
          ))}
        </div>
      )}
      {now && <CurrentTimeLine now={now} dayStart={day} />}
    </div>
  );
});

interface CalendarPanelProps {
  days: Date[];
  entries: CalendarEntry[];
  now: Date;
  isCurrent: boolean;
  isHighlightingOverlaps: boolean;
}

export function CalendarPanel({
  days,
  entries,
  now,
  isCurrent,
  isHighlightingOverlaps,
}: CalendarPanelProps) {
  const routinesById = useMemo(
    () => new Map(entries.map(entry => [entry.id, entry.routine])),
    [entries],
  );
  return (
    <div
      inert={!isCurrent}
      aria-hidden={!isCurrent || undefined}
      className={cn(
        'grid size-full shrink-0 snap-center snap-always',
        days.length === 1 ? 'grid-cols-1' : 'grid-cols-7',
      )}
    >
      {days.map(day => (
        <DayColumn
          key={day.toISOString()}
          dayTime={day.getTime()}
          entries={entries}
          now={checkIsSameDay(day, now) ? now : null}
          routinesById={isHighlightingOverlaps ? routinesById : null}
        />
      ))}
    </div>
  );
}
