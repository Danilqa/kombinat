import type { RunRecord } from '@web-app/lib/api';

const absoluteFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const shortFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

interface RelativeUnit {
  unit: Intl.RelativeTimeFormatUnit;
  seconds: number;
}

const SECOND: RelativeUnit = { unit: 'second', seconds: 1 };

const relativeUnits: RelativeUnit[] = [
  { unit: 'year', seconds: 365 * 24 * 3600 },
  { unit: 'month', seconds: 30 * 24 * 3600 },
  { unit: 'week', seconds: 7 * 24 * 3600 },
  { unit: 'day', seconds: 24 * 3600 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  SECOND,
];

export function formatAbsolute(iso: string): string {
  return absoluteFormatter.format(new Date(iso));
}

export function formatClock(date: Date): string {
  return clockFormatter.format(date);
}

export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${monthFormatter.format(date)}`;
}

export function formatWeekday(date: Date): string {
  return weekdayFormatter.format(date);
}

export function formatShort(iso: string): string {
  return shortFormatter.format(new Date(iso));
}

export function formatRelative(iso: string, now: number = Date.now()): string {
  const diffSeconds = (new Date(iso).getTime() - now) / 1000;
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 10) return 'just now';
  const { unit, seconds } =
    relativeUnits.find(candidate => absSeconds >= candidate.seconds) ?? SECOND;
  return relativeFormatter.format(Math.round(diffSeconds / seconds), unit);
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function getRunDurationMs(
  run: Pick<RunRecord, 'startedAt' | 'endedAt'>,
  now: number = Date.now(),
): number {
  const end = run.endedAt ? new Date(run.endedAt).getTime() : now;
  return end - new Date(run.startedAt).getTime();
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
