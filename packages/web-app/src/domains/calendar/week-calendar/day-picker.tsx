import { cn } from 'design-system';
import { checkIsSameDay } from './calendar-layout';
import { DayHeader } from './day-header';

interface DayPickerProps {
  days: Date[];
  selectedIndex: number;
  now: Date;
  onSelect: (index: number) => void;
}

export function DayPicker({ days, selectedIndex, now, onSelect }: DayPickerProps) {
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
