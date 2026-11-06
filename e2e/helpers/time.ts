const MINUTE_MS = 60_000;

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString();
}

export function todayAt(hour: number, minute = 0): string {
  const today = new Date();
  today.setUTCHours(hour, minute, 0, 0);
  return today.toISOString();
}

export function formatDay(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${date.getUTCDate()}`;
}
