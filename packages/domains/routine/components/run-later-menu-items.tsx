import { useState } from 'react';
import { CalendarClock, Clock } from 'lucide-react';

import { DropdownMenu } from 'design-system/components';
import { formatDayTime } from 'utils/date-time';

import { getRunLaterPresets } from '../../scheduler/utils';

interface RunLaterMenuItemsProps {
  onSchedule: (at: Date) => void;
  onPickTime: () => void;
}

export function RunLaterMenuItems({ onSchedule, onPickTime }: RunLaterMenuItemsProps) {
  // The menu mounts its items each time it opens, so the times count from the moment it opens.
  const [presets] = useState(() => getRunLaterPresets(new Date()));
  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label>Run once later</DropdownMenu.Label>
      {presets.map(({ label, at }) => (
        <DropdownMenu.Item key={label} onSelect={() => onSchedule(at)}>
          <Clock aria-hidden="true" />
          {label}
          <span className="ml-auto pl-4 text-fg-muted tabular-nums">
            {formatDayTime(at.toISOString())}
          </span>
        </DropdownMenu.Item>
      ))}
      <DropdownMenu.Item onSelect={onPickTime}>
        <CalendarClock aria-hidden="true" />
        Pick a time…
      </DropdownMenu.Item>
    </DropdownMenu.Group>
  );
}
