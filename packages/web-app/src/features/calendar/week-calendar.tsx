import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, ChevronLeft, ChevronRight, Clock, Ellipsis, Loader, X } from 'lucide-react';
import { Link } from 'react-router';
import { isMatching, match } from 'ts-pattern';
import { Button } from 'design-system/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from 'design-system/components/dropdown-menu';
import { ErrorState } from 'design-system/components/page-states';
import { cn } from 'design-system/utils';
import { getCalendar } from 'domains/calendar/requests';
import type { CalendarEntry } from 'domains/calendar/types';
import type { RunStatus } from 'domains/run/types';
import { getRunStatusLabel } from 'domains/run/utils';
import { formatClock, formatDayMonth, formatWeekday } from 'utils/date-time';
import { usePolledData } from 'utils/hooks/use-polled-data';
import { sameOriginApi } from 'utils/http';
import { useStoredBoolean } from '@web-app/hooks/use-stored-boolean';
import {
  addDays,
  countOverlapPairs,
  getIsSameDay,
  getMinutesIntoDay,
  getWeekStart,
  getWeekdayIndex,
  layoutDay,
  type PositionedEntry,
} from './calendar-layout';

const POLL_INTERVALS = { activeMs: 60_000, idleMs: 60_000 };
const NOW_TICK_MS = 60_000;
const MIN_TIME_LABEL_MINUTES = 45;
const HIGHLIGHT_OVERLAPS_KEY = 'kombinat:calendar:highlight-overlaps';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

type BlockVariant = 'planned' | 'plannedDefault' | RunStatus;

interface BlockStyle {
  className: string;
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
    icon: null,
  },
  plannedDefault: {
    className: cn(blockSurfaceClassNames.plannedDefault, outlinedBlockClassName),
    icon: null,
  },
  succeeded: {
    className: cn(blockSurfaceClassNames.succeeded, tintedBlockClassName),
    icon: blockIcons.succeeded,
  },
  failed: {
    className: cn(blockSurfaceClassNames.failed, tintedBlockClassName),
    icon: blockIcons.failed,
  },
  timed_out: {
    className: cn(blockSurfaceClassNames.timed_out, tintedBlockClassName),
    icon: blockIcons.timed_out,
  },
  aborted: {
    className: cn(blockSurfaceClassNames.aborted, tintedBlockClassName),
    icon: blockIcons.aborted,
  },
  running: {
    className: cn(blockSurfaceClassNames.running, tintedBlockClassName, 'animate-soft-pulse'),
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
    .with({ kind: 'run' }, run => getRunStatusLabel(run.status).toLowerCase())
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

function getLengthForMinutes(minutes: number): string {
  return `calc(var(--hour-height) * ${minutes / 60})`;
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
  const hasTimeLabel = height >= MIN_TIME_LABEL_MINUTES;
  const title = getEntryTitle(entry, overlapLabel);
  const Icon = style.icon?.component;
  return (
    <Link
      to={getEntryHref(entry)}
      title={title}
      aria-label={title}
      className={cn(
        '@container absolute z-10 flex flex-col overflow-hidden rounded-sm px-1.5 py-0.5 text-fg transition-[filter,border-color] hover:z-20 focus-visible:z-30 max-sm:py-1',
        !hasTimeLabel && 'justify-center',
        style.className,
      )}
      style={{
        top: getLengthForMinutes(top),
        height: getLengthForMinutes(height),
        left: `calc(${left * 100}% + 1px)`,
        width: `calc(${width * 100}% - 2px)`,
      }}
    >
      <span
        className={cn(
          '@container relative flex min-w-0 items-center gap-1 text-body-sm leading-4 font-medium',
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
        <span className={cn('truncate', Icon ? '@max-[32px]:hidden' : '@max-[18px]:hidden')}>
          {entry.routine}
        </span>
        {overlapLabel && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -right-[3px] size-1.5 -translate-y-1/2 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--negative)]"
          />
        )}
      </span>
      {hasTimeLabel && (
        <span className="truncate text-caption leading-4 font-normal text-fg-secondary tabular-nums @max-[34px]:hidden">
          {formatClock(new Date(entry.start))}
        </span>
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
      style={{ top: `calc(${getLengthForMinutes(getMinutesIntoDay(now, dayStart))} - 1px)` }}
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
    <span className="flex flex-col items-center gap-1 py-2.5">
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
    </span>
  );
}

interface DayPickerProps {
  days: Date[];
  selectedIndex: number;
  now: Date;
  onSelect: (index: number) => void;
}

function DayPicker({ days, selectedIndex, now, onSelect }: DayPickerProps) {
  return (
    <div className="grid grid-cols-7 gap-1 px-2 py-1 sm:hidden">
      {days.map((day, index) => {
        const isToday = getIsSameDay(day, now);
        const isSelected = index === selectedIndex;
        return (
          <button
            key={day.toISOString()}
            type="button"
            aria-pressed={isSelected}
            aria-current={isToday ? 'date' : undefined}
            onClick={() => onSelect(index)}
            className={cn(
              'rounded-lg transition-colors',
              isSelected ? 'bg-overlay' : 'hover:bg-hover',
            )}
          >
            <DayHeader day={day} isToday={isToday} />
          </button>
        );
      })}
    </div>
  );
}

interface DayColumnProps {
  day: Date;
  entries: CalendarEntry[];
  now: Date;
  isToday: boolean;
  isSelected: boolean;
  routinesById: Map<string, string> | null;
}

function DayColumn({ day, entries, now, isToday, isSelected, routinesById }: DayColumnProps) {
  const positioned = useMemo(() => layoutDay(entries, day), [entries, day]);
  return (
    <div
      className={cn(
        'relative border-l border-line-faint',
        getIsWeekend(day) && 'bg-hover',
        !isSelected && 'max-sm:hidden',
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom, var(--line-faint) 1px, transparent 1px)`,
        backgroundSize: '100% var(--hour-height)',
      }}
    >
      {positioned.map(item => (
        <CalendarBlock
          key={item.entry.id}
          positioned={item}
          overlapLabel={routinesById && getOverlapLabel(item.entry, routinesById)}
        />
      ))}
      {isToday && <CurrentTimeLine now={now} dayStart={day} />}
    </div>
  );
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

interface CalendarOptionsProps {
  isHighlightingOverlaps: boolean;
  overlapCount: number | null;
  onHighlightOverlapsChange: (isHighlighting: boolean) => void;
}

function CalendarOptions({
  isHighlightingOverlaps,
  overlapCount,
  onHighlightOverlapsChange,
}: CalendarOptionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="tertiary" size="icon-small" aria-label="Calendar options">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={isHighlightingOverlaps}
          onCheckedChange={onHighlightOverlapsChange}
        >
          Highlight overlaps
          {overlapCount !== null && (
            <span className="ml-auto pl-6 text-fg-muted tabular-nums">
              {overlapCount} this week
            </span>
          )}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface CalendarLegendProps {
  isHighlightingOverlaps: boolean;
}

function CalendarLegend({ isHighlightingOverlaps }: CalendarLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-body-sm text-fg-muted">
      {legendItems.map(item => (
        <span key={item.label} className="flex items-center gap-1.5">
          <LegendSwatch variant={item.variant} />
          {item.label}
        </span>
      ))}
      {isHighlightingOverlaps && (
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--negative)]" />
          Overlaps another routine
        </span>
      )}
    </div>
  );
}

export function WeekCalendar() {
  const now = useNow(NOW_TICK_MS);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => getWeekdayIndex(new Date()));
  const [isHighlightingOverlaps, setIsHighlightingOverlaps] = useStoredBoolean(
    HIGHLIGHT_OVERLAPS_KEY,
    false,
  );
  const weekEnd = addDays(weekStart, 7);
  const { data, error } = usePolledData(
    `calendar:${weekStart.toISOString()}`,
    () => getCalendar(sameOriginApi, weekStart, weekEnd),
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

  const showToday = () => {
    const today = new Date();
    setWeekStart(getWeekStart(today));
    setSelectedDayIndex(getWeekdayIndex(today));
  };

  return (
    <>
      {error && <ErrorState message={error} />}
      <div className="text-fg [--hour-height:48px] max-sm:[--hour-height:60px]">
        <div className="sticky top-[var(--app-header-height,0px)] z-40 bg-page">
          <div className="rounded-t-xl border-x border-t border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 aria-live="polite" className="text-title-md text-fg tabular-nums">
                {formatWeekRange(weekStart)}
              </h2>
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
                  className="text-nav-sm"
                  onClick={showToday}
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
                <CalendarOptions
                  isHighlightingOverlaps={isHighlightingOverlaps}
                  overlapCount={data ? overlapCount : null}
                  onHighlightOverlapsChange={setIsHighlightingOverlaps}
                />
              </div>
            </div>
            <div className="border-b border-line">
              <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] pr-2 max-sm:hidden">
                <div />
                {days.map(day => (
                  <DayHeader key={day.toISOString()} day={day} isToday={getIsSameDay(day, now)} />
                ))}
              </div>
              <DayPicker
                days={days}
                selectedIndex={selectedDayIndex}
                now={now}
                onSelect={setSelectedDayIndex}
              />
            </div>
          </div>
        </div>
        <div className="rounded-b-xl border-x border-b border-line bg-surface">
          <div className="py-2 pr-2">
            <div className="grid h-[calc(var(--hour-height)*24)] grid-cols-[48px_minmax(0,1fr)] border-b border-line-faint sm:grid-cols-[56px_repeat(7,minmax(0,1fr))]">
              <div className="relative">
                {HOURS.map(hour => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-caption font-normal text-fg-muted tabular-nums"
                    style={{ top: getLengthForMinutes(hour * 60) }}
                  >
                    {formatHour(hour)}
                  </span>
                ))}
              </div>
              {days.map((day, index) => (
                <DayColumn
                  key={day.toISOString()}
                  day={day}
                  entries={entries}
                  now={now}
                  isToday={getIsSameDay(day, now)}
                  isSelected={index === selectedDayIndex}
                  routinesById={isHighlightingOverlaps ? routinesById : null}
                />
              ))}
            </div>
          </div>
          <CalendarLegend isHighlightingOverlaps={isHighlightingOverlaps} />
        </div>
      </div>
    </>
  );
}
