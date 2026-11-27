import { INSIGHTS_PERIOD_ERROR } from 'domains/insights/constants';
import { buildInsights, parseInsightsPeriod } from 'domains/insights/utils';
import { getTokenUsageStart } from 'domains/run/utils';

import { loadRoutines } from '../domains/routine/storage';
import { listRunsSince } from '../domains/run/storage';
import { readSettings } from '../domains/settings/storage';
import { fail, ok } from './response';
import type { ApiResponse } from './response';

export function getInsights(url: URL): ApiResponse {
  const days = parseInsightsPeriod(url.searchParams);
  if (days === null) return fail(400, INSIGHTS_PERIOD_ERROR);
  const now = new Date();
  const since = getTokenUsageStart(now, days * 2);
  const runs = loadRoutines().flatMap(routine => listRunsSince(routine.name, since));
  return ok(buildInsights(runs, days, now, readSettings().runRetentionDays));
}
