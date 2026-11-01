import type { RunRecord } from '../shared/contract';

const timestampFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

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

export function formatRelative(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '-';
  const diff = new Date(iso).getTime() - now;
  if (Math.abs(diff) < 10_000) return 'now';
  return diff > 0 ? `in ${formatSpan(diff)}` : `${formatSpan(diff)} ago`;
}

export function formatTimestamp(iso: string): string {
  return timestampFormatter.format(new Date(iso));
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
