import type { HttpClient } from 'utils/http';

import { insightsSchema } from './schemas';
import type { Insights, InsightsPeriod } from './types';

export async function getInsights(http: HttpClient, days: InsightsPeriod): Promise<Insights> {
  return http.request(`/api/insights?days=${days}`, insightsSchema);
}
