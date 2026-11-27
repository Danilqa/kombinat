import type { Api } from 'utils/api';

import { insightsSchema } from './schemas';
import type { Insights, InsightsPeriod } from './types';

export async function getInsights(api: Api, days: InsightsPeriod): Promise<Insights> {
  return api.get('/api/insights', { searchParams: { days } }).json(insightsSchema);
}
