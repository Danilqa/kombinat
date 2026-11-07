import { isMatching } from 'ts-pattern';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import { getRuns } from 'domains/run/requests';
import type { RunRecord } from 'domains/run/types';
import { sameOriginApi } from 'utils/http';
import { PageHeader, SectionAside } from '@web-app/components/page-header';
import { ErrorState, LoadingState } from '@web-app/components/page-states';
import { RunsTable } from '@web-app/components/runs-table';
import { Card } from '@web-app/components/ui/card';
import { useDocumentTitle } from '@web-app/lib/use-document-title';
import { usePolledData } from '@web-app/lib/use-polled-data';

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
