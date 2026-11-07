import { match } from 'ts-pattern';

import { formatClock, formatDayMonth, formatWeekday } from 'utils/date-time';

import { getRunStatusLabel } from '../run/utils';
import type { CalendarEntry } from './types';

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

export function getCalendarEntryOverlapLabel(
  entry: CalendarEntry,
  routinesById: Map<string, string>,
): string | null {
  const names = [...new Set(entry.overlaps.map(id => routinesById.get(id) ?? id))];
  return names.length > 0 ? `Overlaps with ${names.join(', ')}` : null;
}

export function getCalendarEntryTitle(entry: CalendarEntry, overlapLabel: string | null): string {
  const start = new Date(entry.start);
  const day = `${formatWeekday(start)} ${formatDayMonth(start)}`;
  const summary = `${entry.routine}, ${day}, ${formatClock(start)}–${formatClock(new Date(entry.end))}, ${getStateLabel(entry)}`;
  return [summary, overlapLabel].filter(Boolean).join('\n');
}

export function countOverlapPairs(entries: Array<Pick<CalendarEntry, 'id' | 'overlaps'>>): number {
  const pairs = new Set(
    entries.flatMap(entry => entry.overlaps.map(other => [entry.id, other].sort().join('\u0000'))),
  );
  return pairs.size;
}
