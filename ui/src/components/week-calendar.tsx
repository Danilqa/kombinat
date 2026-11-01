import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { SectionTitle } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchCalendar, type CalendarEntry, type RunStatus } from '@/lib/api';
import {
  DAY_HEIGHT,
  HOUR_HEIGHT,
  addDays,
  countOverlapPairs,
  getIsSameDay,
  getTopForTime,
  getWeekStart,
  layoutDay,
  type PositionedEntry,
} from '@/lib/calendar-layout';
import { formatClock, formatDayMonth, formatWeekday } from '@/lib/format';
import { usePolledData } from '@/lib/use-polled-data';
import { cn } from '@/lib/utils';

const POLL_INTERVALS = { activeMs: 60_000, idleMs: 60_000 };
const NOW_TICK_MS = 60_000;
const MIN_TIME_LABEL_HEIGHT = 28;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

type BlockVariant = 'planned' | 'plannedDefault' | RunStatus;

type BlockStyle = {
  className: string;
  label: string;
};

const blockStyles: Record<BlockVariant, BlockStyle> = {
  planned: { className: 'border border-grey-20 bg-white hover:border-grey-40', label: 'planned' },
  plannedDefault: {
    className: 'border border-dashed border-grey-20 bg-white hover:border-grey-40',
    label: 'planned',
  },
  succeeded: {
    className:
      'bg-light-green-30 pl-[7px] shadow-[inset_3px_0_0_var(--dark-green)] hover:brightness-[.97]',
    label: 'succeeded',
  },
  failed: {
    className:
      'bg-light-red-20 pl-[7px] shadow-[inset_3px_0_0_var(--dark-red)] hover:brightness-[.97]',
    label: 'failed',
  },
  timed_out: {
    className:
      'bg-light-red-20 pl-[7px] shadow-[inset_3px_0_0_var(--dark-red)] hover:brightness-[.97]',
    label: 'timed out',
  },
  aborted: {
    className: 'bg-grey-5 pl-[7px] shadow-[inset_3px_0_0_var(--grey-30)] hover:brightness-[.97]',
    label: 'aborted',
  },
  running: {
    className:
      'animate-soft-pulse bg-light-yellow-60 pl-[7px] shadow-[inset_3px_0_0_var(--dark-yellow)] hover:brightness-[.97]',
    label: 'running',
  },
};

type LegendItem = {
  label: string;
  swatchClassName: string;
};

const legendItems: LegendItem[] = [
  { label: 'Planned', swatchClassName: 'border border-grey-20 bg-white' },
  {
    label: 'Planned, default length',
    swatchClassName: 'border border-dashed border-grey-20 bg-white',
  },
  {
    label: 'Succeeded',
    swatchClassName: 'bg-light-green-30 shadow-[inset_3px_0_0_var(--dark-green)]',
  },
  { label: 'Failed', swatchClassName: 'bg-light-red-20 shadow-[inset_3px_0_0_var(--dark-red)]' },
  {
    label: 'Running',
    swatchClassName: 'bg-light-yellow-60 shadow-[inset_3px_0_0_var(--dark-yellow)]',
  },
];

function getBlockVariant(entry: CalendarEntry): BlockVariant {
  return match(entry)
    .with({ kind: 'planned', estimated: true }, () => 'planned' as const)
    .with({ kind: 'planned', estimated: false }, () => 'plannedDefault' as const)
    .with({ kind: 'run' }, run => run.status)
    .exhaustive();
}

function getEntryHref(entry: CalendarEntry): string {
  return match(entry)
    .with(
      { kind: 'run' },
      run => `/runs/${encodeURIComponent(run.routine)}/${encodeURIComponent(run.runId)}`,
    )
    .with({ kind: 'planned' }, planned => `/routines/${encodeURIComponent(planned.routine)}`)
    .exhaustive();
}

function getDurationMinutes(entry: CalendarEntry): number {
  return Math.round((new Date(entry.end).getTime() - new Date(entry.start).getTime()) / 60_000);
}

function getStateLabel(entry: CalendarEntry): string {
  return match(entry)
    .with(
      { kind: 'planned', estimated: true },
      planned => `planned (estimated ${getDurationMinutes(planned)} min)`,
    )
    .with(
      { kind: 'planned', estimated: false },
      planned => `planned (default ${getDurationMinutes(planned)} min, no past runs)`,
    )
    .with({ kind: 'run' }, run => blockStyles[run.status].label)
    .exhaustive();
}

function getOverlapLabel(entry: CalendarEntry, routinesById: Map<string, string>): string | null {
  const names = [...new Set(entry.overlaps.map(id => routinesById.get(id) ?? id))];
  return names.length > 0 ? `Overlaps with ${names.join(', ')}` : null;
}

function getEntryTitle(entry: CalendarEntry, overlapLabel: string | null): string {
  const summary = `${entry.routine} · ${formatClock(new Date(entry.start))}–${formatClock(new Date(entry.end))} · ${getStateLabel(entry)}`;
  return [summary, overlapLabel].filter(Boolean).join('\n');
}

function formatWeekRange(weekStart: Date): string {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 6))}`;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function getHasRunningEntry(entries: CalendarEntry[]): boolean {
  return entries.some(entry => entry.status === 'running');
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

type DayTone = 'today' | 'other';

const dayHeaderTextClassNames: Record<DayTone, string> = {
  today: 'text-black',
  other: 'text-grey-60',
};

const dayNumberClassNames: Record<DayTone, string> = {
  today: 'bg-black text-white',
  other: 'text-black',
};

function getDayTone(isToday: boolean): DayTone {
  return match(isToday)
    .with(true, () => 'today' as const)
    .with(false, () => 'other' as const)
    .exhaustive();
}

function CalendarBlock({
  positioned,
  overlapLabel,
}: {
  positioned: PositionedEntry<CalendarEntry>;
  overlapLabel: string | null;
}) {
  const { entry, top, height, left, width } = positioned;
  const style = blockStyles[getBlockVariant(entry)];
  const hasTimeLabel = height >= MIN_TIME_LABEL_HEIGHT;
  return (
    <Link
      to={getEntryHref(entry)}
      title={getEntryTitle(entry, overlapLabel)}
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden rounded-4 px-1.5 text-black transition-[filter,border-color] hover:z-20',
        style.className,
      )}
      style={{
        top,
        height,
        left: `calc(${left * 100}% + 1px)`,
        width: `calc(${width * 100}% - 2px)`,
        paddingTop: hasTimeLabel ? 3 : 0,
      }}
    >
      <span
        className={cn(
          'truncate text-[11px] leading-[12px] font-semibold',
          overlapLabel && 'pr-2.5',
        )}
      >
        {entry.routine}
      </span>
      {hasTimeLabel && (
        <span className="truncate text-[10px] leading-[12px] text-grey-60 tabular-nums">
          {formatClock(new Date(entry.start))}
        </span>
      )}
      {overlapLabel && (
        <span
          title={overlapLabel}
          className="absolute top-[3px] right-[3px] size-1.5 rounded-full bg-white shadow-[0_0_0_1.5px_var(--dark-red)]"
        />
      )}
    </Link>
  );
}

function CurrentTimeLine({ now, dayStart }: { now: Date; dayStart: Date }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-black"
      style={{ top: getTopForTime(now, dayStart) - 1 }}
    >
      <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-black" />
    </div>
  );
}

function DayHeader({ day, isToday }: { day: Date; isToday: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2.5">
      <span className={cn('text-label-13 uppercase', dayHeaderTextClassNames[getDayTone(isToday)])}>
        {formatWeekday(day)}
      </span>
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full text-title-16 tabular-nums',
          dayNumberClassNames[getDayTone(isToday)],
        )}
      >
        {day.getDate()}
      </span>
    </div>
  );
}

function DayColumn({
  day,
  entries,
  now,
  isToday,
  routinesById,
}: {
  day: Date;
  entries: CalendarEntry[];
  now: Date;
  isToday: boolean;
  routinesById: Map<string, string>;
}) {
  const positioned = useMemo(() => layoutDay(entries, day), [entries, day]);
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
  return (
    <div
      className={cn('relative border-l border-grey-10', isWeekend && 'bg-grey-2')}
      style={{
        backgroundImage: `linear-gradient(to bottom, var(--grey-10) 1px, transparent 1px)`,
        backgroundSize: `100% ${HOUR_HEIGHT}px`,
      }}
    >
      {positioned.map(item => (
        <CalendarBlock
          key={item.entry.id}
          positioned={item}
          overlapLabel={getOverlapLabel(item.entry, routinesById)}
        />
      ))}
      {isToday && <CurrentTimeLine now={now} dayStart={day} />}
    </div>
  );
}

function formatOverlapCount(count: number): string {
  return match(count)
    .with(1, () => '1 overlap this week')
    .otherwise(total => `${total} overlaps this week`);
}

function OverlapChip({ count }: { count: number }) {
  return match(count > 0)
    .with(true, () => <Badge variant="negative">{formatOverlapCount(count)}</Badge>)
    .with(false, () => <Badge variant="neutral">no overlaps</Badge>)
    .exhaustive();
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-grey-10 px-4 py-3 text-paragraph-12 text-grey-60">
      {legendItems.map(item => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn('h-2.5 w-4 rounded-[2px]', item.swatchClassName)} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-white shadow-[0_0_0_1.5px_var(--dark-red)]" />
        Overlaps another routine
      </span>
    </div>
  );
}

export function WeekCalendar() {
  const now = useNow(NOW_TICK_MS);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekEnd = addDays(weekStart, 7);
  const { data, error } = usePolledData(
    `calendar:${weekStart.toISOString()}`,
    () => fetchCalendar(weekStart, weekEnd),
    getHasRunningEntry,
    POLL_INTERVALS,
  );
  const entries = data ?? [];
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const routinesById = useMemo(
    () => new Map(entries.map(entry => [entry.id, entry.routine])),
    [entries],
  );
  const overlapCount = useMemo(() => countOverlapPairs(entries), [entries]);
  const isCurrentWeek = getIsSameDay(weekStart, getWeekStart(now));

  return (
    <section>
      <SectionTitle>Calendar</SectionTitle>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="tertiary"
            size="icon-small"
            aria-label="Previous week"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="tertiary"
            size="small"
            isActive={isCurrentWeek}
            aria-pressed={isCurrentWeek}
            onClick={() => setWeekStart(getWeekStart(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="tertiary"
            size="icon-small"
            aria-label="Next week"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight />
          </Button>
          <span className="ml-2 text-headline-h3 text-black tabular-nums">
            {formatWeekRange(weekStart)}
          </span>
          {error && (
            <span className="ml-3 text-paragraph-12 font-medium text-dark-red">{error}</span>
          )}
        </div>
        {data && <OverlapChip count={overlapCount} />}
      </div>
      <Card className="gap-0 py-0">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-grey-10">
          <div />
          {days.map(day => (
            <DayHeader key={day.toISOString()} day={day} isToday={getIsSameDay(day, now)} />
          ))}
        </div>
        <div className="py-2 pr-2">
          <div
            className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-grey-10"
            style={{ height: DAY_HEIGHT }}
          >
            <div className="relative">
              {HOURS.map(hour => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] leading-none font-medium tracking-[0.03em] text-grey-40 tabular-nums"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {formatHour(hour)}
                </span>
              ))}
            </div>
            {days.map(day => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                entries={entries}
                now={now}
                isToday={getIsSameDay(day, now)}
                routinesById={routinesById}
              />
            ))}
          </div>
        </div>
        <CalendarLegend />
      </Card>
    </section>
  );
}
