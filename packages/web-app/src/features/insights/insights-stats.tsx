import { Card } from 'design-system/components';
import type { Insights, InsightsTotals } from 'domains/insights/types';
import {
  formatFailedShare,
  formatInsightsChange,
  formatRetentionNote,
} from 'domains/insights/utils';
import { formatTokens } from 'domains/run/utils';
import { formatDuration } from 'utils/date-time';
import { Stat } from '@web-app/components/stat';

const countFormatter = new Intl.NumberFormat('en');

interface InsightsStatsProps {
  insights: Insights;
}

export function InsightsStats({ insights }: InsightsStatsProps) {
  const { current, previous, days, retentionDays } = insights;
  const getChange = (value: number, pick: (totals: InsightsTotals) => number | null) =>
    previous === null
      ? formatRetentionNote(retentionDays)
      : formatInsightsChange(value, pick(previous), days);
  return (
    <Card.Root className="gap-0 py-0">
      <dl className="grid grid-cols-2 gap-6 p-4 md:grid-cols-4">
        <Stat
          label="Tokens"
          value={formatTokens(current.tokens)}
          note={getChange(current.tokens, totals => totals.tokens)}
        />
        <Stat
          label="Runs"
          value={countFormatter.format(current.runs)}
          note={getChange(current.runs, totals => totals.runs)}
        />
        <Stat
          label="Failed"
          value={countFormatter.format(current.failed)}
          note={formatFailedShare(current)}
        />
        <Stat
          label="Average run time"
          value={formatDuration(current.averageRunMs)}
          note={
            current.averageRunMs !== null
              ? getChange(current.averageRunMs, totals => totals.averageRunMs)
              : current.finished === 0
                ? 'No finished runs'
                : 'Only aborted runs'
          }
        />
      </dl>
    </Card.Root>
  );
}
