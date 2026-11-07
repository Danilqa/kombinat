import { isMatching } from 'ts-pattern';
import { Card } from 'design-system/components/card';
import { ErrorState, LoadingState } from 'design-system/components/page-states';
import { PageHeader, SectionAside } from 'design-system/layouts/page-header';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import { getRuns } from 'domains/run/requests';
import type { RunRecord } from 'domains/run/types';
import { usePolledData } from 'utils/hooks/use-polled-data';
import { sameOriginApi } from 'utils/http';
import { RunsTable } from '@web-app/components/runs-table';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function loadRuns(): Promise<RunRecord[]> {
  return getRuns(sameOriginApi, RECENT_RUNS_LIMIT);
}

function getHasRunningRun(runs: RunRecord[]): boolean {
  return runs.some(isMatching({ status: 'running' }));
}

export function RunsPage() {
  useDocumentTitle('Runs');
  const { data, error } = usePolledData('runs', loadRuns, getHasRunningRun);

  return (
    <div>
      <PageHeader title="Runs" aside={data && <SectionAside>{data.length} runs</SectionAside>} />
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && (
        <Card className="gap-0 overflow-visible py-0">
          <RunsTable runs={data} hasRoutineColumn />
        </Card>
      )}
    </div>
  );
}
