import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { cn } from 'design-system';
import type { CalendarEntry } from 'domains/calendar/types';
import { getCalendarEntryTitle } from 'domains/calendar/utils';
import { formatClock } from 'utils/date-time';
import { getRoutinePath, getRunPath } from '@web-app/paths';
import { getBlockStyle, getBlockVariant } from './block-styles';
import { getLengthForMinutes, type PositionedEntry } from './calendar-layout';

const MIN_TIME_LABEL_MINUTES = 45;

function getEntryHref(entry: CalendarEntry): string {
  return match(entry)
    .with({ kind: 'run' }, run => getRunPath(run.routine, run.runId))
    .with({ kind: 'planned' }, planned => getRoutinePath(planned.routine))
    .exhaustive();
}

interface CalendarBlockProps {
  positioned: PositionedEntry<CalendarEntry>;
  overlapLabel: string | null;
}

export function CalendarBlock({ positioned, overlapLabel }: CalendarBlockProps) {
  const { entry, top, height, left, width } = positioned;
  const style = getBlockStyle(getBlockVariant(entry));
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
            className={cn('size-2.5 shrink-0', style.icon?.className, style.iconMotionClassName)}
          />
        )}
        <span className={cn('truncate', Icon ? '@max-[32px]:hidden' : '@max-[18px]:hidden')}>
          {entry.routine}
        </span>
        {overlapLabel && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -right-0.75 size-1.5 -translate-y-1/2 rounded-full bg-surface shadow-outline-negative"
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
