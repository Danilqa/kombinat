import { CALENDAR_RANGE_ERROR } from 'domains/calendar/constants';
import { buildCalendar, parseCalendarRange } from 'domains/calendar/utils';

import { loadRoutines } from '../domains/routine/storage';
import { listAllRuns } from '../domains/run/storage';
import { readOneTimeRuns } from '../domains/scheduler/storage';
import { fail, ok } from './response';
import type { ApiResponse } from './response';

export function getCalendar(url: URL): ApiResponse {
  const range = parseCalendarRange(url.searchParams);
  if (range === null) return fail(400, CALENDAR_RANGE_ERROR);
  return ok(buildCalendar(loadRoutines(), listAllRuns(), readOneTimeRuns(), range.from, range.to));
}
