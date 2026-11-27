import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getInsights } from 'domains/insights/requests';
import type { InsightsPeriod } from 'domains/insights/types';
import { api } from '@web-app/api';
import { getPollInterval } from '@web-app/polling';
import { INSIGHTS_QUERY_KEY } from '@web-app/query-keys';

export function useInsights(days: InsightsPeriod) {
  return useQuery({
    queryKey: [...INSIGHTS_QUERY_KEY, days],
    queryFn: () => getInsights(api, days),
    refetchInterval: getPollInterval(false),
    // The other period's numbers stay until this one's come, so the page does not jump.
    placeholderData: keepPreviousData,
  });
}
