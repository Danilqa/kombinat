import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Ban, Check, ChevronLeft, ChevronRight, Clock, Ellipsis, Loader, X } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { Button, DropdownMenu, ErrorState } from 'design-system/components';
import { cn } from 'design-system/utils';
import { getCalendar } from 'domains/calendar/requests';
import type { CalendarEntry } from 'domains/calendar/types';
import type { CalendarEntryId, RoutineId } from 'domains/id/types';
import {
  countOverlapPairs,
  getCalendarEntryOverlapLabel,
  getCalendarEntryTitle,
} from 'domains/calendar/utils';
import type { RunStatus } from 'domains/run/types';
import { formatClock, formatDayMonth, formatWeekday } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';
import { getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useStoredBoolean } from '@web-app/hooks/use-stored-boolean';
import {
  addDays,
  checkIsSameDay,
  getDayStart,
  getMinutesIntoDay,
  getWeekStart,
  getWeekdayIndex,
  layoutDay,
  type PositionedEntry,
} from './calendar-layout';

const POLL_MS = 60_000;
const NOW_TICK_MS = 60_000;
const MIN_TIME_LABEL_MINUTES = 45;
const HIGHLIGHT_OVERLAPS_KEY = 'kombinat:calendar:highlight-overlaps';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const PHONE_QUERY = '(width < 40rem)';
const SETTLE_DELAY_MS = 150;
const WHEEL_RELEASE_MS = 120;
const WHEEL_STEP_SHARE = 0.15;
const WHEEL_LINE_PX = 16;
// Room for quick swipes in a row on a phone before the scroller recentres.
const PHONE_PANEL_RADIUS = 3;

type StepDirection = -1 | 1;

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
    .with({ kind: 'run' }, run => getRunPath(run.routine, run.runId))
    .with({ kind: 'planned' }, planned => getRoutinePath(planned.routine))
    .exhaustive();
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

function checkIsWeekend(day: Date): boolean {
  return day.getDay() === 0 || day.getDay() === 6;
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
  return match({ isToday, isWeekend: checkIsWeekend(day) })
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
  const title = getCalendarEntryTitle(entry, overlapLabel);
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
      <span className="absolute -top-[3px] left-0 size-2 rounded-full bg-warning" />
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
        const isToday = checkIsSameDay(day, now);
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
  routinesById: Map<CalendarEntryId, RoutineId> | null;
}

function DayColumn({ day, entries, now, isToday, routinesById }: DayColumnProps) {
  const positioned = useMemo(() => layoutDay(entries, day), [entries, day]);
  return (
    <div
      className={cn('relative border-l border-line-faint', checkIsWeekend(day) && 'bg-hover')}
      style={{
        backgroundImage: `linear-gradient(to bottom, var(--line-faint) 1px, transparent 1px)`,
        backgroundSize: '100% var(--hour-height)',
      }}
    >
      {positioned.map(item => (
        <CalendarBlock
          key={item.entry.id}
          positioned={item}
          overlapLabel={routinesById && getCalendarEntryOverlapLabel(item.entry, routinesById)}
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="tertiary" size="icon-small" aria-label="Calendar options">
          <Ellipsis />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.CheckboxItem
          checked={isHighlightingOverlaps}
          onCheckedChange={onHighlightOverlapsChange}
        >
          Highlight overlaps
          {overlapCount !== null && (
            <span className="ml-auto pl-6 text-fg-muted tabular-nums">
              {overlapCount} this week
            </span>
          )}
        </DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
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

function subscribeToPhoneQuery(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function checkIsPhone(): boolean {
  return window.matchMedia(PHONE_QUERY).matches;
}

function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhoneQuery, checkIsPhone);
}

// Rounded, so a day that is 23 or 25 hours long around a clock change still counts as one.
function countWholeDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

function getWheelDeltaX(event: WheelEvent, pageWidth: number): number {
  const delta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
  return match(event.deltaMode)
    .with(WheelEvent.DOM_DELTA_LINE, () => delta * WHEEL_LINE_PX)
    .with(WheelEvent.DOM_DELTA_PAGE, () => delta * pageWidth)
    .otherwise(() => delta);
}

function checkIsTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

function useCalendarWeek(weekStart: Date, isPolling: boolean): UseQueryResult<CalendarEntry[]> {
  return useQuery({
    queryKey: ['calendar', weekStart.toISOString()],
    queryFn: () => getCalendar(sameOriginApi, weekStart, addDays(weekStart, 7)),
    refetchInterval: isPolling ? POLL_MS : false,
  });
}

interface SwipePanels {
  scrollerRef: RefObject<HTMLDivElement | null>;
  headerTrackRef: RefObject<HTMLDivElement | null>;
  preview: number;
  slide: (direction: StepDirection) => void;
}

// Once scrolling stops, the period moves to the panel in view and the scroller recentres in one frame.
function useSwipePanels(
  periodKey: string,
  radius: number,
  onStep: (steps: number) => void,
): SwipePanels {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const headerTrackRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(0);
  const onStepRef = useRef(onStep);
  const settleRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    onStepRef.current = onStep;
  });

  const syncHeader = useCallback(() => {
    const scroller = scrollerRef.current;
    const track = headerTrackRef.current;
    if (scroller && track) track.style.translate = `${-scroller.scrollLeft}px 0`;
  }, []);

  const recentre = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    scroller.scrollLeft = scroller.clientWidth * radius;
    syncHeader();
  }, [radius, syncHeader]);

  useLayoutEffect(recentre, [periodKey, recentre]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let isWheeling = false;
    let isTouching = false;
    let shownPreview = 0;
    const getPanelOffset = () => {
      const width = scroller.clientWidth;
      return width === 0 ? 0 : scroller.scrollLeft / width - radius;
    };
    const updatePreview = () => {
      const next = Math.max(-radius, Math.min(radius, Math.round(getPanelOffset())));
      if (next === shownPreview) return;
      shownPreview = next;
      setPreview(next);
    };
    const settle = () => {
      clearTimeout(timer);
      if (isWheeling || isTouching) return;
      const offset = getPanelOffset();
      const steps = Math.round(offset);
      if (steps === 0 || Math.abs(offset - steps) * scroller.clientWidth > 1) return;
      flushSync(() => {
        onStepRef.current(steps);
        setPreview(0);
      });
      shownPreview = 0;
      recentre();
    };
    // Safari before 26 has no scrollend, so a pause in scrolling counts as the end too.
    const scheduleSettle = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_DELAY_MS);
    };
    const handleScroll = () => {
      syncHeader();
      updatePreview();
      scheduleSettle();
    };
    const handleTouchStart = () => {
      isTouching = true;
      clearTimeout(timer);
    };
    const handleTouchEnd = () => {
      isTouching = false;
      scheduleSettle();
    };
    // Snapping would undo every mouse wheel notch, so the wheel moves the panels until it stops.
    const releaseWheel = () => {
      isWheeling = false;
      const offset = getPanelOffset();
      const direction = Math.abs(offset) > WHEEL_STEP_SHARE ? Math.sign(offset) : 0;
      const target = scroller.clientWidth * (radius + direction);
      scroller.style.scrollSnapType = '';
      if (Math.abs(scroller.scrollLeft - target) <= 1) settle();
      else scroller.scrollTo({ left: target, behavior: getScrollBehavior() });
    };
    const handleWheel = (event: WheelEvent) => {
      const width = scroller.clientWidth;
      const deltaX = getWheelDeltaX(event, width);
      if (Math.abs(deltaX) <= Math.abs(event.shiftKey ? 0 : event.deltaY)) return;
      event.preventDefault();
      isWheeling = true;
      scroller.style.scrollSnapType = 'none';
      const centre = width * radius;
      scroller.scrollLeft = Math.min(
        Math.max(scroller.scrollLeft + deltaX, centre - width),
        centre + width,
      );
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(releaseWheel, WHEEL_RELEASE_MS);
    };
    const resizeObserver = new ResizeObserver(recentre);
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    scroller.addEventListener('scrollend', settle);
    scroller.addEventListener('wheel', handleWheel, { passive: false });
    scroller.addEventListener('touchstart', handleTouchStart, { passive: true });
    scroller.addEventListener('touchend', handleTouchEnd, { passive: true });
    scroller.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    resizeObserver.observe(scroller);
    settleRef.current = settle;
    return () => {
      clearTimeout(timer);
      clearTimeout(wheelTimer);
      scroller.removeEventListener('scroll', handleScroll);
      scroller.removeEventListener('scrollend', settle);
      scroller.removeEventListener('wheel', handleWheel);
      scroller.removeEventListener('touchstart', handleTouchStart);
      scroller.removeEventListener('touchend', handleTouchEnd);
      scroller.removeEventListener('touchcancel', handleTouchEnd);
      resizeObserver.disconnect();
    };
  }, [radius, recentre, syncHeader]);

  // Commits a finished slide first, or its pending settle would undo this one.
  const slide = useCallback(
    (direction: StepDirection) => {
      const scroller = scrollerRef.current;
      if (scroller === null || scroller.clientWidth === 0) return;
      settleRef.current();
      const inView = Math.round(scroller.scrollLeft / scroller.clientWidth);
      const target = Math.max(0, Math.min(radius * 2, inView + direction));
      scroller.scrollTo({ left: scroller.clientWidth * target, behavior: getScrollBehavior() });
    },
    [radius],
  );

  return { scrollerRef, headerTrackRef, preview, slide };
}

interface CalendarPanelProps {
  days: Date[];
  entries: CalendarEntry[];
  now: Date;
  isCurrent: boolean;
  isHighlightingOverlaps: boolean;
}

function CalendarPanel({
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
        'grid h-full w-full shrink-0 snap-center snap-always',
        days.length === 1 ? 'grid-cols-1' : 'grid-cols-7',
      )}
    >
      {days.map(day => (
        <DayColumn
          key={day.toISOString()}
          day={day}
          entries={entries}
          now={now}
          isToday={checkIsSameDay(day, now)}
          routinesById={isHighlightingOverlaps ? routinesById : null}
        />
      ))}
    </div>
  );
}

export function WeekCalendar() {
  const now = useNow(NOW_TICK_MS);
  const isPhone = useIsPhone();
  const [selectedDay, setSelectedDay] = useState(() => getDayStart(new Date()));
  const [isHighlightingOverlaps, setIsHighlightingOverlaps] = useStoredBoolean(
    HIGHLIGHT_OVERLAPS_KEY,
    false,
  );
  const weekStart = getWeekStart(selectedDay);
  const stepDays = isPhone ? 1 : 7;
  const panelRadius = isPhone ? PHONE_PANEL_RADIUS : 1;
  const previousWeek = useCalendarWeek(addDays(weekStart, -7), false);
  const currentWeek = useCalendarWeek(weekStart, true);
  const nextWeek = useCalendarWeek(addDays(weekStart, 7), false);
  const entries = currentWeek.data ?? [];
  const overlapCount = useMemo(() => countOverlapPairs(entries), [entries]);
  const panelAnchors = Array.from({ length: panelRadius * 2 + 1 }, (_, index) =>
    addDays(selectedDay, (index - panelRadius) * stepDays),
  );

  const getWeekEntries = (day: Date): CalendarEntry[] => {
    const offset = countWholeDays(weekStart, getWeekStart(day)) / 7;
    const week = match(offset)
      .with(-1, () => previousWeek)
      .with(1, () => nextWeek)
      .otherwise(() => currentWeek);
    return week.data ?? [];
  };

  const { scrollerRef, headerTrackRef, preview, slide } = useSwipePanels(
    `${selectedDay.toISOString()}:${stepDays}`,
    panelRadius,
    steps => setSelectedDay(day => addDays(day, steps * stepDays)),
  );
  const visibleDay = addDays(selectedDay, preview * stepDays);
  const visibleWeekStart = getWeekStart(visibleDay);
  const isCurrentWeek = checkIsSameDay(visibleWeekStart, getWeekStart(now));

  const showWeek = (direction: StepDirection) => {
    if (isPhone) setSelectedDay(day => addDays(day, direction * 7));
    else slide(direction);
  };

  const showToday = () => {
    const today = getDayStart(new Date());
    const steps = isPhone
      ? countWholeDays(selectedDay, today)
      : countWholeDays(weekStart, getWeekStart(today)) / 7;
    if (steps === 1 || steps === -1) slide(steps);
    else setSelectedDay(today);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || checkIsTypingTarget(event.target)) {
        return;
      }
      match(event.key.toLowerCase())
        .with('j', 'n', () => slide(1))
        .with('k', 'p', () => slide(-1))
        .with('t', showToday)
        .otherwise(() => undefined);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <>
      {currentWeek.error && <ErrorState message={currentWeek.error.message} />}
      <div className="text-fg [--hour-height:48px] max-sm:[--hour-height:60px]">
        <div className="sticky top-[var(--app-header-height,0px)] z-40 bg-page">
          <div className="rounded-t-xl border-x border-t border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 aria-live="polite" className="text-title-md text-fg tabular-nums">
                {formatWeekRange(visibleWeekStart)}
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="tertiary"
                  size="icon-small"
                  aria-label="Previous week"
                  aria-keyshortcuts="K"
                  onClick={() => showWeek(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="tertiary"
                  size="small"
                  isActive={isCurrentWeek}
                  aria-keyshortcuts="T"
                  className="text-nav-sm"
                  onClick={showToday}
                >
                  Today
                </Button>
                <Button
                  variant="tertiary"
                  size="icon-small"
                  aria-label="Next week"
                  aria-keyshortcuts="J"
                  onClick={() => showWeek(1)}
                >
                  <ChevronRight />
                </Button>
                <CalendarOptions
                  isHighlightingOverlaps={isHighlightingOverlaps}
                  overlapCount={currentWeek.data ? overlapCount : null}
                  onHighlightOverlapsChange={setIsHighlightingOverlaps}
                />
              </div>
            </div>
            <div className="border-b border-line">
              {!isPhone && (
                <div className="flex pr-2">
                  <div className="w-14 shrink-0" />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div ref={headerTrackRef} className="flex">
                      {panelAnchors.map((anchor, index) => (
                        <div
                          key={anchor.toISOString()}
                          aria-hidden={index !== panelRadius || undefined}
                          className="grid w-full shrink-0 grid-cols-7"
                        >
                          {getWeekDays(getWeekStart(anchor)).map(day => (
                            <DayHeader
                              key={day.toISOString()}
                              day={day}
                              isToday={checkIsSameDay(day, now)}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {isPhone && (
                <DayPicker
                  days={getWeekDays(visibleWeekStart)}
                  selectedIndex={getWeekdayIndex(visibleDay)}
                  now={now}
                  onSelect={index => setSelectedDay(addDays(visibleWeekStart, index))}
                />
              )}
            </div>
          </div>
        </div>
        <div className="rounded-b-xl border-x border-b border-line bg-surface">
          <div className="py-2 pr-2">
            <div className="flex h-[calc(var(--hour-height)*24)] border-b border-line-faint">
              <div className="relative w-12 shrink-0 sm:w-14">
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
              <div
                ref={scrollerRef}
                className="flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {panelAnchors.map((anchor, index) => (
                  <CalendarPanel
                    key={anchor.toISOString()}
                    days={isPhone ? [anchor] : getWeekDays(getWeekStart(anchor))}
                    entries={getWeekEntries(anchor)}
                    now={now}
                    isCurrent={index === panelRadius}
                    isHighlightingOverlaps={isHighlightingOverlaps}
                  />
                ))}
              </div>
            </div>
          </div>
          <CalendarLegend isHighlightingOverlaps={isHighlightingOverlaps} />
        </div>
      </div>
    </>
  );
}
