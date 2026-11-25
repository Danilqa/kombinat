export interface CronFields {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  dayOfMonthRestricted: boolean;
  dayOfWeekRestricted: boolean;
}

type CronParts = [
  minute: string,
  hour: string,
  dayOfMonth: string,
  month: string,
  dayOfWeek: string,
];

function splitCron(expression: string): CronParts {
  const [minute, hour, dayOfMonth, month, dayOfWeek, ...rest] = expression.trim().split(/\s+/);
  if (
    minute === undefined ||
    hour === undefined ||
    dayOfMonth === undefined ||
    month === undefined ||
    dayOfWeek === undefined ||
    rest.length > 0
  ) {
    throw new Error(`Cron expression must have 5 fields, got "${expression}"`);
  }
  return [minute, hour, dayOfMonth, month, dayOfWeek];
}

function parseBounds(range: string, hasStep: boolean, min: number, max: number): [number, number] {
  if (range === '*') return [min, max];
  if (range.includes('-')) {
    const [from = Number.NaN, to = Number.NaN] = range.split('-').map(Number);
    return [from, to];
  }
  const start = Number(range);
  return [start, hasStep ? max : start];
}

function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const [range = '', stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Cron step in "${part}" must be a whole number of 1 or more`);
    }
    const [start, end] = parseBounds(range, stepPart !== undefined, min, max);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      throw new Error(
        `Cron field "${field}" must use numbers from ${min} to ${max}, with ranges from low to high`,
      );
    }
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return values;
}

export function parseCron(expression: string): CronFields {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = splitCron(expression);
  return {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dayOfMonth: parseField(dayOfMonth, 1, 31),
    month: parseField(month, 1, 12),
    dayOfWeek: new Set([...parseField(dayOfWeek, 0, 7)].map(day => (day === 7 ? 0 : day))),
    dayOfMonthRestricted: dayOfMonth !== '*',
    dayOfWeekRestricted: dayOfWeek !== '*',
  };
}

function checkMatchesFields(c: CronFields, date: Date): boolean {
  if (
    !c.minute.has(date.getMinutes()) ||
    !c.hour.has(date.getHours()) ||
    !c.month.has(date.getMonth() + 1)
  )
    return false;
  const domMatch = c.dayOfMonth.has(date.getDate());
  const dowMatch = c.dayOfWeek.has(date.getDay());
  if (c.dayOfMonthRestricted && c.dayOfWeekRestricted) return domMatch || dowMatch;
  if (c.dayOfMonthRestricted) return domMatch;
  if (c.dayOfWeekRestricted) return dowMatch;
  return true;
}

export function checkMatchesCron(expression: string, date: Date): boolean {
  return checkMatchesFields(parseCron(expression), date);
}

export function nextCronRun(expression: string, after: Date): Date | undefined {
  const fields = parseCron(expression);
  const cursor = new Date(after);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (checkMatchesFields(fields, cursor)) return cursor;
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return undefined;
}

export function cronRunsBetween(
  expression: string,
  afterExclusive: Date,
  untilInclusive: Date,
): Date[] {
  const fields = parseCron(expression);
  const runs: Date[] = [];
  const cursor = new Date(afterExclusive);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  while (cursor <= untilInclusive) {
    if (!fields.hour.has(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0);
      continue;
    }
    if (checkMatchesFields(fields, cursor)) runs.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return runs;
}

interface NumberRun {
  from: number;
  to: number;
}

const sortNumbers = (values: Set<number>) => [...values].sort((a, b) => a - b);

function getRuns(values: Set<number>): NumberRun[] {
  const runs: NumberRun[] = [];
  for (const value of sortNumbers(values)) {
    const last = runs.at(-1);
    if (last?.to === value - 1) last.to = value;
    else runs.push({ from: value, to: value });
  }
  return runs;
}

function getHourRuns(hours: Set<number>): NumberRun[] {
  const runs = getRuns(hours);
  const first = runs[0];
  const last = runs.at(-1);
  if (runs.length > 1 && first?.from === 0 && last?.to === 23) {
    runs.shift();
    last.to = first.to;
  }
  return runs;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ORDINAL_SUFFIXES: Record<number, string> = {
  1: 'st',
  2: 'nd',
  3: 'rd',
  21: 'st',
  22: 'nd',
  23: 'rd',
  31: 'st',
};
const MAX_LISTED = 4;
const STEP_PATTERN = /^\*\/\d+$/;
const pad = (n: number) => String(n).padStart(2, '0');

function joinWords(words: string[]): string {
  const last = words.at(-1) ?? '';
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${last}` : last;
}

function describeRuns(values: Set<number>, describe: (value: number) => string): string {
  return joinWords(
    getRuns(values).map(({ from, to }) =>
      from === to ? describe(from) : `${describe(from)}-${describe(to)}`,
    ),
  );
}

function checkHasSameValues(values: Set<number>, expected: number[]): boolean {
  return values.size === expected.length && expected.every(value => values.has(value));
}

// The times of day, when there are few enough to name each. A range or a step of hours reads better as a span.
function getClockTimes(c: CronFields, hour: string): string[] | null {
  if (c.minute.size * c.hour.size > MAX_LISTED) return null;
  if (c.minute.size === 1 && c.hour.size > 1 && /[-/]/.test(hour)) return null;
  return sortNumbers(c.hour).flatMap(h => sortNumbers(c.minute).map(m => `${pad(h)}:${pad(m)}`));
}

function describeMinutes(minute: string, minutes: Set<number>): string {
  if (minutes.size === 60) return 'Every minute';
  if (STEP_PATTERN.test(minute)) return `Every ${minute.slice(2)} minutes`;
  if (minutes.size <= MAX_LISTED) {
    return `At ${joinWords(sortNumbers(minutes).map(m => `:${pad(m)}`))}`;
  }
  return `At minutes ${describeRuns(minutes, String)}`;
}

function describeHourSpans(hour: string, hours: Set<number>): string {
  if (STEP_PATTERN.test(hour)) return `every ${hour.slice(2)} hours`;
  return joinWords(getHourRuns(hours).map(({ from, to }) => `${pad(from)}:00-${pad(to)}:59`));
}

function describeHoursAtMinute(c: CronFields, hour: string, minute: number): string {
  if (c.hour.size === 24) return `Hourly at :${pad(minute)}`;
  if (/^[^,]+\/\d+$/.test(hour)) {
    const [first, last] = [Math.min(...c.hour), Math.max(...c.hour)].map(
      h => `${pad(h)}:${pad(minute)}`,
    );
    const span = hour.startsWith('*') ? `from ${first}` : `${first}-${last}`;
    return `Every ${hour.split('/')[1]} hours at :${pad(minute)}, ${span}`;
  }
  if (hour.includes('-')) {
    const spans = getHourRuns(c.hour).map(({ from, to }) =>
      from === to ? `${pad(from)}:${pad(minute)}` : `${pad(from)}:00-${pad(to)}:59`,
    );
    return `Hourly at :${pad(minute)}, ${joinWords(spans)}`;
  }
  return `At :${pad(minute)} on hours ${sortNumbers(c.hour).join(', ')}`;
}

function describeRepeat(c: CronFields, minute: string, hour: string): string {
  const [singleMinute] = c.minute;
  if (c.minute.size === 1 && singleMinute !== undefined) {
    return describeHoursAtMinute(c, hour, singleMinute);
  }
  const minutes = describeMinutes(minute, c.minute);
  if (c.hour.size < 24) return `${minutes}, ${describeHourSpans(hour, c.hour)}`;
  return minutes.startsWith('At') ? `${minutes} of every hour` : minutes;
}

function describeDaysOfWeek(days: Set<number>): string {
  if (checkHasSameValues(days, [1, 2, 3, 4, 5])) return 'on weekdays';
  if (checkHasSameValues(days, [0, 6])) return 'on weekends';
  return `on ${joinWords(sortNumbers(days).map(day => DAY_NAMES[day] ?? String(day)))}`;
}

function describeDaysOfMonth(dayOfMonth: string, days: Set<number>): string {
  if (STEP_PATTERN.test(dayOfMonth)) return `on every ${dayOfMonth.slice(2)} days of the month`;
  if (days.size > MAX_LISTED) return `on days ${describeRuns(days, String)} of the month`;
  const ordinals = sortNumbers(days).map(day => `${day}${ORDINAL_SUFFIXES[day] ?? 'th'}`);
  return `on the ${joinWords(ordinals)} of the month`;
}

function describeMonths(month: string, months: Set<number>): string {
  if (STEP_PATTERN.test(month)) return `every ${month.slice(2)} months`;
  const getName = (month: number) => MONTH_NAMES[month - 1] ?? String(month);
  if (months.size > MAX_LISTED) return `in ${describeRuns(months, getName)}`;
  return `in ${joinWords(sortNumbers(months).map(getName))}`;
}

function joinParts(parts: string[]): string {
  return parts
    .filter(part => part !== '')
    .reduce((text, part) => (text.includes(',') ? `${text}, ${part}` : `${text} ${part}`));
}

// Always words, never the expression itself: the dashboard shows this text in place of the cron.
export function describeCron(expression: string): string {
  const [minute, hour, dayOfMonth, month] = splitCron(expression);
  const c = parseCron(expression);
  // The scheduler runs on a day that either field matches, so one that covers every day leaves nothing to say.
  const isEveryDay =
    c.dayOfWeekRestricted &&
    c.dayOfMonthRestricted &&
    (c.dayOfWeek.size === 7 || c.dayOfMonth.size === 31);
  const hasDaysOfWeek = !isEveryDay && c.dayOfWeekRestricted && c.dayOfWeek.size < 7;
  const hasDaysOfMonth = !isEveryDay && c.dayOfMonthRestricted && c.dayOfMonth.size < 31;
  const hasMonths = c.month.size < 12;
  const daysOfWeek = hasDaysOfWeek ? describeDaysOfWeek(c.dayOfWeek) : '';
  const daysOfMonth = hasDaysOfMonth ? describeDaysOfMonth(dayOfMonth, c.dayOfMonth) : '';
  const days = hasDaysOfWeek && hasDaysOfMonth ? `${daysOfMonth} or ${daysOfWeek}` : daysOfMonth;
  const months = hasMonths ? describeMonths(month, c.month) : '';
  const clockTimes = getClockTimes(c, hour);

  if (clockTimes === null) {
    return joinParts([describeRepeat(c, minute, hour), days || daysOfWeek, months]);
  }
  const times = joinWords(clockTimes);
  if (!hasDaysOfMonth && !hasMonths) {
    const dayNames = sortNumbers(c.dayOfWeek).map(day => DAY_NAMES[day] ?? String(day));
    if (!hasDaysOfWeek) return `Daily at ${times}`;
    if (daysOfWeek === 'on weekdays') return `Weekdays at ${times}`;
    if (daysOfWeek === 'on weekends') return `Weekends at ${times}`;
    if (dayNames.length === 1) return `Weekly on ${dayNames[0]} at ${times}`;
    return `${dayNames.join(', ')} at ${times}`;
  }
  if (!hasDaysOfWeek && !hasMonths && c.dayOfMonth.size === 1) {
    return `Monthly ${daysOfMonth.replace(' of the month', '')} at ${times}`;
  }
  return joinParts([`At ${times}`, days || daysOfWeek, months]);
}
