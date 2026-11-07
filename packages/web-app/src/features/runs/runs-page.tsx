import { isMatching } from 'ts-pattern';
import { Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
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

function checkHasRunningRun(runs: RunRecord[]): boolean {
  return runs.some(isMatching({ status: 'running' }));
}

export function RunsPage() {
  useDocumentTitle('Runs');
  const { data, error } = usePolledData('runs', loadRuns, checkHasRunningRun);

  return (
    <div>
      <PageHeader.Root
        title="Runs"
        aside={data && <PageHeader.Aside>{data.length} runs</PageHeader.Aside>}
      />
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && (
        <Card.Root className="gap-0 overflow-visible py-0">
          <RunsTable runs={data} hasRoutineColumn />
        </Card.Root>
      )}
    </div>
  );
}
