const MINUTE_MS = 60_000;

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString();
}

// The browser and the daemon run in UTC, see playwright.config.ts.
export function todayAt(hour: number, minute = 0): string {
  const today = new Date();
  today.setUTCHours(hour, minute, 0, 0);
  return today.toISOString();
}

// How the calendar names a day on phones, for example "Thu 5".
export function formatDay(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${date.getUTCDate()}`;
}
