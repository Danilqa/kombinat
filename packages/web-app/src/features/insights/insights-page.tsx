import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, Tabs } from 'design-system/components';
import { PageHeader, SectionHeader } from 'design-system/layouts';
import { getInsights } from 'domains/insights/requests';
import { insightsPeriodSchema } from 'domains/insights/schemas';
import type { Insights } from 'domains/insights/types';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useTabSearchParam } from '@web-app/hooks/use-tab-search-param';
import { InsightsRoutinesSection } from './insights-routines-section';
import { InsightsStats } from './insights-stats';
import { getRunBars, getTokenBars } from './day-chart-bars';
import { DayChartSection } from './day-chart-section';

const PERIOD_TABS = ['7', '30'] as const;

function FailedLegend() {
  return (
    <SectionHeader.Aside>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-negative" />
        Failed
      </span>
    </SectionHeader.Aside>
  );
}

interface InsightsViewProps {
  insights: Insights;
}

function InsightsView({ insights }: InsightsViewProps) {
  return (
    <div className="space-y-10">
      <InsightsStats insights={insights} />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
        <DayChartSection
          key={`tokens-${insights.days}`}
          title="Tokens per day"
          aside={<SectionHeader.Aside>Includes cache reads</SectionHeader.Aside>}
          bars={getTokenBars(insights.daily)}
        />
        <DayChartSection
          key={`runs-${insights.days}`}
          title="Runs per day"
          aside={<FailedLegend />}
          bars={getRunBars(insights.daily)}
        />
      </div>
      <InsightsRoutinesSection insights={insights} />
    </div>
  );
}

export function InsightsPage() {
  useDocumentTitle('Insights');
  const [tab, setTab] = useTabSearchParam(PERIOD_TABS, 'days');
  const days = insightsPeriodSchema.parse(Number(tab));
  const { data, error, isPending } = useQuery({
    queryKey: ['insights', days],
    queryFn: () => getInsights(sameOriginApi, days),
    refetchInterval: getPollInterval(false),
    // The other period's numbers stay until this one's come, so the page does not jump.
    placeholderData: keepPreviousData,
  });

  return (
    <Tabs.Root value={tab} onValueChange={setTab} className="gap-0">
      <PageHeader.Root
        title="Insights"
        aside={
          <Tabs.List aria-label="Period">
            {PERIOD_TABS.map(period => (
              <Tabs.Trigger key={period} value={period}>
                {period} days
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        }
      />
      <Tabs.Content value={tab}>
        {error && <ErrorState message={error.message} />}
        {isPending && <LoadingState />}
        {data && <InsightsView insights={data} />}
      </Tabs.Content>
    </Tabs.Root>
  );
}
