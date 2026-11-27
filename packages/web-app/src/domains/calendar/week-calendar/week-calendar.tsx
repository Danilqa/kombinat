import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { match } from 'ts-pattern';
import { Button, ErrorState } from 'design-system';
import type { CalendarEntry } from 'domains/calendar/types';
import { countOverlapPairs } from 'domains/calendar/utils';
import { formatDayMonth } from 'utils/date-time';
import { useStoredBoolean } from '@web-app/hooks';
import { useCalendarWeek } from '../queries';
import {
  addDays,
  checkIsSameDay,
  getDayStart,
  getLengthForMinutes,
  getWeekStart,
  getWeekdayIndex,
} from './calendar-layout';
import { CalendarLegend } from './calendar-legend';
import { CalendarOptions } from './calendar-options';
import { CalendarPanel } from './calendar-panel';
import { DayHeader } from './day-header';
import { DayPicker } from './day-picker';
import { useIsPhone } from './use-is-phone';
import { useNow } from './use-now';
import { useSwipePanels, type StepDirection } from './use-swipe-panels';

const NOW_TICK_MS = 60_000;
const HIGHLIGHT_OVERLAPS_KEY = 'kombinat:calendar:highlight-overlaps';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// Room for quick swipes in a row on a phone before the scroller recentres.
const PHONE_PANEL_RADIUS = 3;

function formatWeekRange(weekStart: Date): string {
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 6))}`;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

// Rounded, so a day that is 23 or 25 hours long around a clock change still counts as one.
function countWholeDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function checkIsTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
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

  const showToday = (behavior?: ScrollBehavior) => {
    const today = getDayStart(new Date());
    const steps = isPhone
      ? countWholeDays(selectedDay, today)
      : countWholeDays(weekStart, getWeekStart(today)) / 7;
    if (steps === 1 || steps === -1) slide(steps, behavior);
    else setSelectedDay(today);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || checkIsTypingTarget(event.target)) {
        return;
      }
      // Shortcuts jump at once, so pressing them again and again never waits for a slide.
      match(event.key.toLowerCase())
        .with('j', 'n', () => slide(1, 'instant'))
        .with('k', 'p', () => slide(-1, 'instant'))
        .with('t', () => showToday('instant'))
        .otherwise(() => undefined);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <>
      {currentWeek.error && <ErrorState message={currentWeek.error.message} />}
      <div className="text-fg [--hour-height:48px] max-sm:[--hour-height:60px]">
        <div className="sticky top-below-headers z-40 bg-page">
          <div className="rounded-t-xl border-x border-t border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 aria-live="polite" className="text-title-md text-fg tabular-nums">
                <span
                  key={visibleWeekStart.toISOString()}
                  className="inline-block animate-in duration-200 fade-in"
                >
                  {formatWeekRange(visibleWeekStart)}
                </span>
              </h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="tertiary"
                  size="icon-small"
                  aria-label="Previous week"
                  aria-keyshortcuts="K"
                  onClick={() => showWeek(-1)}
                >
                  <ChevronLeft className="transition-transform duration-200 ease-out-quint group-hover/button:-translate-x-0.5" />
                </Button>
                <Button
                  variant="tertiary"
                  size="small"
                  isActive={isCurrentWeek}
                  aria-keyshortcuts="T"
                  className="text-nav-sm"
                  onClick={() => showToday()}
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
                  <ChevronRight className="transition-transform duration-200 ease-out-quint group-hover/button:translate-x-0.5" />
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
                className="scrollbar-none flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [&::-webkit-scrollbar]:hidden"
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
