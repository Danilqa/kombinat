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
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid cron step "${part}"`);
    const [start, end] = parseBounds(range, stepPart !== undefined, min, max);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < min ||
      end > max ||
      start > end
    ) {
      throw new Error(`Invalid cron field "${field}" (allowed ${min}-${max})`);
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

function matchesFields(c: CronFields, date: Date): boolean {
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

export function matchesCron(expression: string, date: Date): boolean {
  return matchesFields(parseCron(expression), date);
}

export function nextCronRun(expression: string, after: Date): Date | undefined {
  const fields = parseCron(expression);
  const cursor = new Date(after);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (matchesFields(fields, cursor)) return cursor;
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
    if (matchesFields(fields, cursor)) runs.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return runs;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => String(n).padStart(2, '0');

export function describeCron(expression: string): string {
  const [minute, hour, dom, month, dow] = splitCron(expression);
  const c = parseCron(expression);
  const singleMinute = c.minute.size === 1 ? [...c.minute][0] : undefined;
  const singleHour = c.hour.size === 1 ? [...c.hour][0] : undefined;
  const time =
    singleMinute !== undefined && singleHour !== undefined
      ? `${pad(singleHour)}:${pad(singleMinute)}`
      : undefined;
  const dayNames = [...c.dayOfWeek].sort((a, b) => a - b).map(day => DAY_NAMES[day] ?? String(day));
  const isWeekdays = dow === '1-5';

  if (dom === '*' && month === '*') {
    if (time && dow === '*') return `Daily at ${time}`;
    if (time && isWeekdays) return `Weekdays at ${time}`;
    if (time && dayNames.length === 1) return `Weekly on ${dayNames[0]} at ${time}`;
    if (time) return `${dayNames.join(', ')} at ${time}`;
    if (singleMinute !== undefined && hour === '*' && dow === '*')
      return `Hourly at :${pad(singleMinute)}`;
    if (singleMinute !== undefined && hour.includes('/') && dow === '*') {
      const [first, last] = [Math.min(...c.hour), Math.max(...c.hour)].map(
        h => `${pad(h)}:${pad(singleMinute)}`,
      );
      const span = hour.startsWith('*') ? `from ${first}` : `${first}-${last}`;
      return `Every ${hour.split('/')[1]} hours at :${pad(singleMinute)}, ${span}`;
    }
    if (singleMinute !== undefined && hour.includes('-') && dow === '*') {
      const [from = 0, to = 23] = hour.split('-').map(Number);
      return `Hourly at :${pad(singleMinute)}, ${pad(from)}:00-${pad(to)}:59`;
    }
    if (singleMinute !== undefined && dow === '*' && c.hour.size <= 4) {
      const times = [...c.hour].sort((a, b) => a - b).map(h => `${pad(h)}:${pad(singleMinute)}`);
      return `Daily at ${times.slice(0, -1).join(', ')} and ${times.at(-1) ?? ''}`;
    }
    if (singleMinute !== undefined && dow === '*') {
      return `At :${pad(singleMinute)} on hours ${[...c.hour].sort((a, b) => a - b).join(', ')}`;
    }
    if (minute.startsWith('*/') && hour === '*' && dow === '*')
      return `Every ${minute.slice(2)} minutes`;
  }
  return `cron ${expression}`;
}
