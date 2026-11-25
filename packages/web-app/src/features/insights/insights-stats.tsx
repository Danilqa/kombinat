import { Card } from 'design-system/components';
import type { Insights } from 'domains/insights/types';
import { formatFailedShare, formatInsightsChange } from 'domains/insights/utils';
import { formatTokens } from 'domains/run/utils';
import { formatDuration } from 'utils/date-time';
import { Stat } from '@web-app/components/stat';

const countFormatter = new Intl.NumberFormat('en');

interface InsightsStatsProps {
  insights: Insights;
}

export function InsightsStats({ insights }: InsightsStatsProps) {
  const { current, previous, days } = insights;
  return (
    <Card.Root className="gap-0 py-0">
      <dl className="grid grid-cols-2 gap-6 p-4 md:grid-cols-4">
        <Stat
          label="Tokens"
          value={formatTokens(current.tokens)}
          note={formatInsightsChange(current.tokens, previous.tokens, days)}
        />
        <Stat
          label="Runs"
          value={countFormatter.format(current.runs)}
          note={formatInsightsChange(current.runs, previous.runs, days)}
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
            current.averageRunMs === null
              ? 'No finished runs'
              : formatInsightsChange(current.averageRunMs, previous.averageRunMs, days)
          }
        />
      </dl>
    </Card.Root>
  );
}
