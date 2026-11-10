import { isMatching, match } from 'ts-pattern';

import { cronRunsBetween } from 'utils/cron';
import { formatClock, formatDayMonth, formatWeekday } from 'utils/date-time';

import { calendarEntryIdSchema } from '../id/schemas';
import type { CalendarEntryId, RoutineName } from '../id/types';
import type { RunRecord } from '../run/types';
import { getRunStatusLabel } from '../run/utils';
import type {
  CalendarEntry,
  PlannedCalendarEntry,
  PlannedLength,
  RunCalendarEntry,
  ScheduledRoutine,
} from './types';

const DEFAULT_PLANNED_MINUTES = 20;
const MIN_BLOCK_MINUTES = 10;

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
  routinesById: Map<CalendarEntryId, RoutineName>,
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

function median(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  if (upper === undefined) return null;
  const lower = sorted.length % 2 === 0 ? (sorted[mid - 1] ?? upper) : upper;
  return (lower + upper) / 2;
}

export function estimatePlannedMinutes(
  routine: ScheduledRoutine,
  runs: RunRecord[],
): PlannedLength {
  const finished = runs
    .flatMap(run =>
      run.routine === routine.name &&
      run.endedAt !== null &&
      !isMatching({ status: 'aborted' }, run)
        ? [(new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 60_000]
        : [],
    )
    .slice(0, 5);
  const typical = median(finished);
  if (typical === null)
    return { minutes: Math.min(DEFAULT_PLANNED_MINUTES, routine.timeoutMinutes), estimated: false };
  return {
    minutes: Math.max(MIN_BLOCK_MINUTES, Math.min(Math.ceil(typical), routine.timeoutMinutes)),
    estimated: true,
  };
}

function toRunEntry(run: RunRecord, now: Date): RunCalendarEntry {
  const start = new Date(run.startedAt);
  const rawEnd = run.endedAt ? new Date(run.endedAt) : now;
  const end = new Date(Math.max(rawEnd.getTime(), start.getTime() + MIN_BLOCK_MINUTES * 60_000));
  return {
    id: calendarEntryIdSchema.parse(`run:${run.routine}:${run.id}`),
    routine: run.routine,
    start: start.toISOString(),
    end: end.toISOString(),
    kind: 'run',
    status: run.status,
    runId: run.id,
    trigger: run.trigger,
    estimated: false,
    overlaps: [],
  };
}

function markOverlaps(entries: CalendarEntry[]): CalendarEntry[] {
  const sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((entry, index) => {
    for (const other of sorted.slice(index + 1)) {
      if (other.start >= entry.end) break;
      if (entry.routine === other.routine) continue;
      entry.overlaps.push(other.id);
      other.overlaps.push(entry.id);
    }
  });
  return sorted;
}

export function buildCalendar(
  routines: ScheduledRoutine[],
  runs: RunRecord[],
  from: Date,
  to: Date,
  now = new Date(),
): CalendarEntry[] {
  const runEntries = runs
    .filter(r => new Date(r.startedAt) < to && new Date(r.endedAt ?? now) > from)
    .map(r => toRunEntry(r, now));
  const plannedFrom = new Date(Math.max(from.getTime(), now.getTime()));
  const plannedEntries = routines.flatMap((routine): PlannedCalendarEntry[] => {
    if (!routine.enabled || routine.schedule === null || plannedFrom >= to) return [];
    const { minutes, estimated } = estimatePlannedMinutes(routine, runs);
    return cronRunsBetween(routine.schedule, plannedFrom, to).map(start => ({
      id: calendarEntryIdSchema.parse(`planned:${routine.name}:${start.toISOString()}`),
      routine: routine.name,
      start: start.toISOString(),
      end: new Date(start.getTime() + minutes * 60_000).toISOString(),
      kind: 'planned',
      status: null,
      runId: null,
      trigger: null,
      estimated,
      overlaps: [],
    }));
  });
  return markOverlaps([...runEntries, ...plannedEntries]);
}
