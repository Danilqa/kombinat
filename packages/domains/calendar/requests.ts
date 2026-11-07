import { z } from 'zod';

import type { HttpClient } from 'utils/http';

import { calendarEntrySchema } from './schemas';
import type { CalendarEntry } from './types';

export async function getCalendar(
  http: HttpClient,
  from: Date,
  to: Date,
): Promise<CalendarEntry[]> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return http.request(`/api/calendar?${params.toString()}`, z.array(calendarEntrySchema));
}
