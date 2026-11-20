import { match } from 'ts-pattern';

import type { RoutineName } from '../routine/ids';
import { ONE_TIME_RUN_MAX_DAYS, ONE_TIME_RUNS_LIMIT } from './constants';
import type { OneTimeRun, RunLaterPreset, SkipReason } from './types';

const HOUR_MS = 3_600_000;
const NIGHT_HOUR = 2;
const MORNING_HOUR = 9;
const MONDAY = 1;

export function getSkipReasonLabel(reason: SkipReason): string {
  return match(reason)
    .with('already_running', () => 'already running')
    .with('concurrency_limit', () => 'concurrency limit')
    .with('disabled', () => 'disabled')
    .exhaustive();
}

function atLocalHour(now: Date, daysAhead: number, hour: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// Up, so "In 1 hour" is never a few seconds short of an hour.
function toNextMinute(date: Date): Date {
  const rounded = new Date(date);
  if (rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 1, 0, 0);
  }
  return rounded;
}

export function getTomorrowMorning(now: Date): Date {
  return atLocalHour(now, 1, MORNING_HOUR);
}

export function getRunLaterPresets(now: Date): RunLaterPreset[] {
  const inOneWeek = new Date(now);
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const daysToMonday = (7 + MONDAY - now.getDay()) % 7 || 7;
  return [
    { label: 'In 1 hour', at: toNextMinute(new Date(now.getTime() + HOUR_MS)) },
    {
      label: 'Tonight at 02:00',
      at: atLocalHour(now, now.getHours() < NIGHT_HOUR ? 0 : 1, NIGHT_HOUR),
    },
    { label: 'Tomorrow at 09:00', at: getTomorrowMorning(now) },
    { label: 'Next Monday at 09:00', at: atLocalHour(now, daysToMonday, MORNING_HOUR) },
    { label: 'In 1 week', at: toNextMinute(inOneWeek) },
  ];
}

export function listRoutineOneTimeRuns(runs: OneTimeRun[], routine: RoutineName): OneTimeRun[] {
  return runs.filter(run => run.routine === routine);
}

export function checkHasOneTimeRun(runs: OneTimeRun[], { routine, at }: OneTimeRun): boolean {
  return runs.some(run => run.routine === routine && run.at === at);
}

export function getOneTimeRunError(
  runs: OneTimeRun[],
  { routine, at }: OneTimeRun,
  now: Date,
): string | null {
  const time = new Date(at).getTime();
  if (Number.isNaN(time)) return 'The time must be an ISO date';
  if (time <= now.getTime()) return 'Choose a time in the future';
  if (time - now.getTime() > ONE_TIME_RUN_MAX_DAYS * 24 * HOUR_MS) {
    return 'Choose a time within a year';
  }
  const isNew = !checkHasOneTimeRun(runs, { routine, at });
  if (isNew && listRoutineOneTimeRuns(runs, routine).length >= ONE_TIME_RUNS_LIMIT) {
    return `${routine} already has ${ONE_TIME_RUNS_LIMIT} runs scheduled once, cancel one first`;
  }
  return null;
}

export function addOneTimeRun(runs: OneTimeRun[], run: OneTimeRun): OneTimeRun[] {
  if (checkHasOneTimeRun(runs, run)) return runs;
  return [...runs, run].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function removeOneTimeRun(runs: OneTimeRun[], { routine, at }: OneTimeRun): OneTimeRun[] {
  return runs.filter(run => run.routine !== routine || run.at !== at);
}

export function getNextRunAt(
  nextCronRunAt: string | null,
  oneTimeRuns: OneTimeRun[],
): string | null {
  const times = [nextCronRunAt, ...oneTimeRuns.map(run => run.at)].flatMap(iso =>
    iso === null ? [] : [new Date(iso)],
  );
  if (times.length === 0) return null;
  return new Date(Math.min(...times.map(time => time.getTime()))).toISOString();
}
