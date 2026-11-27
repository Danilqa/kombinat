import { match } from 'ts-pattern';
import { cn } from 'design-system';
import { formatWeekday } from 'utils/date-time';
import { checkIsWeekend } from './calendar-layout';

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

interface DayHeaderProps {
  day: Date;
  isToday: boolean;
}

export function DayHeader({ day, isToday }: DayHeaderProps) {
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
