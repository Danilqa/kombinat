import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getCalendar } from 'domains/calendar/requests';
import type { CalendarEntry } from 'domains/calendar/types';
import { api } from '@web-app/api';
import { CALENDAR_QUERY_KEY } from '@web-app/query-keys';
import { addDays } from './week-calendar/calendar-layout';

const POLL_MS = 60_000;

export function useCalendarWeek(
  weekStart: Date,
  isPolling: boolean,
): UseQueryResult<CalendarEntry[]> {
  return useQuery({
    queryKey: [...CALENDAR_QUERY_KEY, weekStart.toISOString()],
    queryFn: () => getCalendar(api, weekStart, addDays(weekStart, 7)),
    refetchInterval: isPolling ? POLL_MS : false,
  });
}
