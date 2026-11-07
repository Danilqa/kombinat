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

const timestampFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
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

export function formatTimestamp(iso: string): string {
  return timestampFormatter.format(new Date(iso));
}

export function formatRelative(iso: string, now: number = Date.now()): string {
  const diffSeconds = (new Date(iso).getTime() - now) / 1000;
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 10) return 'just now';
  const { unit, seconds } =
    relativeUnits.find(candidate => absSeconds >= candidate.seconds) ?? SECOND;
  return relativeFormatter.format(Math.round(diffSeconds / seconds), unit);
}

// "45s", "5m", "3h 5m", "13h", "2d": short enough for a list column.
export function formatSpan(ms: number): string {
  const seconds = Math.floor(Math.abs(ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 10) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function formatRelativeCompact(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '-';
  const diff = new Date(iso).getTime() - now;
  if (Math.abs(diff) < 10_000) return 'now';
  return diff > 0 ? `in ${formatSpan(diff)}` : `${formatSpan(diff)} ago`;
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
