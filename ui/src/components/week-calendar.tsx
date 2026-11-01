import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, ChevronLeft, ChevronRight, Clock, Loader, X } from 'lucide-react';
import { Link } from 'react-router';
import { isMatching, match } from 'ts-pattern';
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

interface BlockStyle {
  className: string;
  label: string;
  icon: BlockIcon | null;
}

interface BlockIcon {
  component: typeof Check;
  className: string;
}

// Opaque tints, so the current-time line passes behind a block instead of through its text.
const blockSurfaceClassNames: Record<BlockVariant, string> = {
  planned: 'border border-line-strong bg-raised',
  plannedDefault: 'border border-dashed border-line-strong bg-raised',
  succeeded: 'bg-positive-tint shadow-[inset_2px_0_0_var(--positive)]',
  failed: 'bg-negative-tint shadow-[inset_2px_0_0_var(--negative)]',
  timed_out: 'bg-negative-tint shadow-[inset_2px_0_0_var(--negative)]',
  aborted: 'bg-neutral-tint shadow-[inset_2px_0_0_var(--fg-faint)]',
  running: 'bg-warning-tint shadow-[inset_2px_0_0_var(--warning)]',
};

// The icon repeats the outcome that the tint shows, so it does not depend on colour alone.
const blockIcons: Record<RunStatus, BlockIcon> = {
  succeeded: { component: Check, className: 'text-positive' },
  failed: { component: X, className: 'text-negative' },
  timed_out: { component: Clock, className: 'text-negative' },
  aborted: { component: Ban, className: 'text-fg-muted' },
  running: { component: Loader, className: 'text-warning' },
};

const outlinedBlockClassName = 'hover:border-fg-faint';
const tintedBlockClassName = 'pl-[7px] hover:brightness-125 focus-visible:shadow-focus';

const blockStyles: Record<BlockVariant, BlockStyle> = {
  planned: {
    className: cn(blockSurfaceClassNames.planned, outlinedBlockClassName),
    label: 'planned',
    icon: null,
  },
  plannedDefault: {
    className: cn(blockSurfaceClassNames.plannedDefault, outlinedBlockClassName),
    label: 'planned',
    icon: null,
  },
  succeeded: {
    className: cn(blockSurfaceClassNames.succeeded, tintedBlockClassName),
    label: 'succeeded',
    icon: blockIcons.succeeded,
  },
  failed: {
    className: cn(blockSurfaceClassNames.failed, tintedBlockClassName),
    label: 'failed',
    icon: blockIcons.failed,
  },
  timed_out: {
    className: cn(blockSurfaceClassNames.timed_out, tintedBlockClassName),
    label: 'timed out',
    icon: blockIcons.timed_out,
  },
  aborted: {
    className: cn(blockSurfaceClassNames.aborted, tintedBlockClassName),
    label: 'aborted',
    icon: blockIcons.aborted,
  },
  running: {
    className: cn(blockSurfaceClassNames.running, tintedBlockClassName, 'animate-soft-pulse'),
    label: 'running',
    icon: blockIcons.running,
  },
};

interface LegendItem {
  label: string;
  variant: BlockVariant;
}

const legendItems: LegendItem[] = [
  { label: 'Planned', variant: 'planned' },
  { label: 'Planned, default length', variant: 'plannedDefault' },
  { label: 'Succeeded', variant: 'succeeded' },
  { label: 'Failed', variant: 'failed' },
  { label: 'Timed out', variant: 'timed_out' },
  { label: 'Aborted', variant: 'aborted' },
  { label: 'Running', variant: 'running' },
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
  const start = new Date(entry.start);
  const day = `${formatWeekday(start)} ${formatDayMonth(start)}`;
  const summary = `${entry.routine}, ${day}, ${formatClock(start)}–${formatClock(new Date(entry.end))}, ${getStateLabel(entry)}`;
  return [summary, overlapLabel].filter(Boolean).join('\n');
}

function formatWeekRange(weekStart: Date): string {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 6))}`;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function getIsWeekend(day: Date): boolean {
  return day.getDay() === 0 || day.getDay() === 6;
}

function getHasRunningEntry(entries: CalendarEntry[]): boolean {
  return entries.some(isMatching({ status: 'running' }));
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

type DayTone = 'today' | 'weekday' | 'weekend';

const dayHeaderTextClassNames: Record<DayTone, string> = {
  today: 'text-fg',
  weekday: 'text-fg-muted',
  weekend: 'text-fg-muted',
};

const dayNumberClassNames: Record<DayTone, string> = {
  today: 'bg-fg text-page',
  weekday: 'text-fg',
  weekend: 'text-fg-muted',
};

function getDayTone(day: Date, isToday: boolean): DayTone {
  return match({ isToday, isWeekend: getIsWeekend(day) })
    .with({ isToday: true }, () => 'today' as const)
    .with({ isWeekend: true }, () => 'weekend' as const)
    .otherwise(() => 'weekday' as const);
}

interface CalendarBlockProps {
  positioned: PositionedEntry<CalendarEntry>;
  overlapLabel: string | null;
}

function CalendarBlock({ positioned, overlapLabel }: CalendarBlockProps) {
  const { entry, top, height, left, width } = positioned;
  const style = blockStyles[getBlockVariant(entry)];
  const hasTimeLabel = height >= MIN_TIME_LABEL_HEIGHT;
  const title = getEntryTitle(entry, overlapLabel);
  const Icon = style.icon?.component;
  return (
    <Link
      to={getEntryHref(entry)}
      title={title}
      aria-label={title}
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden rounded-sm px-1.5 text-fg transition-[filter,border-color] hover:z-20 focus-visible:z-30',
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
          'flex min-w-0 items-center gap-1 text-caption leading-3',
          overlapLabel && 'pr-2.5',
        )}
      >
        {Icon && (
          <Icon
            aria-hidden="true"
            strokeWidth={3}
            className={cn('size-2.5 shrink-0', style.icon?.className)}
          />
        )}
        <span className="truncate">{entry.routine}</span>
      </span>
      {hasTimeLabel && (
        <span className="truncate text-caption leading-3 font-normal text-fg-secondary tabular-nums">
          {formatClock(new Date(entry.start))}
        </span>
      )}
      {overlapLabel && (
        <span
          aria-hidden="true"
          className="absolute top-[3px] right-[3px] size-1.5 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--negative)]"
        />
      )}
    </Link>
  );
}

interface CurrentTimeLineProps {
  now: Date;
  dayStart: Date;
}

function CurrentTimeLine({ now, dayStart }: CurrentTimeLineProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-[5] h-0.5 bg-warning"
      style={{ top: getTopForTime(now, dayStart) - 1 }}
    >
      <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-warning" />
    </div>
  );
}

interface DayHeaderProps {
  day: Date;
  isToday: boolean;
}

function DayHeader({ day, isToday }: DayHeaderProps) {
  const tone = getDayTone(day, isToday);
  return (
    <div className="flex flex-col items-center gap-1 py-2.5">
      <span className={cn('text-caption', dayHeaderTextClassNames[tone])}>
        {formatWeekday(day)}
      </span>
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-full text-title-sm tabular-nums',
          dayNumberClassNames[tone],
        )}
      >
        {day.getDate()}
      </span>
    </div>
  );
}

interface DayColumnProps {
  day: Date;
  entries: CalendarEntry[];
  now: Date;
  isToday: boolean;
  routinesById: Map<string, string>;
}

function DayColumn({ day, entries, now, isToday, routinesById }: DayColumnProps) {
  const positioned = useMemo(() => layoutDay(entries, day), [entries, day]);
  return (
    <div
      className={cn('relative border-l border-line-faint', getIsWeekend(day) && 'bg-hover')}
      style={{
        backgroundImage: `linear-gradient(to bottom, var(--line-faint) 1px, transparent 1px)`,
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

interface OverlapChipProps {
  count: number;
}

function OverlapChip({ count }: OverlapChipProps) {
  return match(count > 0)
    .with(true, () => <Badge variant="negative">{formatOverlapCount(count)}</Badge>)
    .with(false, () => <Badge variant="neutral">No overlaps</Badge>)
    .exhaustive();
}

interface LegendSwatchProps {
  variant: BlockVariant;
}

function LegendSwatch({ variant }: LegendSwatchProps) {
  const icon = blockStyles[variant].icon;
  const Icon = icon?.component;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-3.5 w-5 items-center justify-center rounded-xs',
        blockSurfaceClassNames[variant],
      )}
    >
      {Icon && <Icon strokeWidth={3} className={cn('size-2.5', icon.className)} />}
    </span>
  );
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-body-sm text-fg-muted">
      {legendItems.map(item => (
        <span key={item.label} className="flex items-center gap-1.5">
          <LegendSwatch variant={item.variant} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--negative)]" />
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
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 aria-live="polite" className="text-title-md text-fg tabular-nums">
            {formatWeekRange(weekStart)}
          </h2>
          {error && (
            <span role="alert" className="text-body-sm text-negative">
              {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && <OverlapChip count={overlapCount} />}
          <div className="flex items-center gap-1">
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
          </div>
        </div>
      </div>
      {/* Below ~720px the week scrolls sideways inside the card instead of squeezing the days. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line pr-2">
            <div className="sticky left-0 z-40 bg-surface" />
            {days.map(day => (
              <DayHeader key={day.toISOString()} day={day} isToday={getIsSameDay(day, now)} />
            ))}
          </div>
          <div className="py-2 pr-2">
            <div
              className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line-faint"
              style={{ height: DAY_HEIGHT }}
            >
              <div className="sticky left-0 z-40 bg-surface">
                {HOURS.map(hour => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-caption font-normal text-fg-muted tabular-nums"
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
        </div>
      </div>
      <CalendarLegend />
    </Card>
  );
}
