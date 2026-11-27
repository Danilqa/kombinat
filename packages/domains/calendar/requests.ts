import { z } from 'zod';

import type { Api } from 'utils/api';

import { calendarEntrySchema } from './schemas';
import type { CalendarEntry } from './types';

export async function getCalendar(api: Api, from: Date, to: Date): Promise<CalendarEntry[]> {
  return api
    .get('/api/calendar', { searchParams: { from: from.toISOString(), to: to.toISOString() } })
    .json(z.array(calendarEntrySchema));
}
