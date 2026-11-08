import { useQuery } from '@tanstack/react-query';
import { isMatching } from 'ts-pattern';
import { Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { RECENT_RUNS_LIMIT } from 'domains/run/constants';
import { getRuns } from 'domains/run/requests';
import type { RunRecord } from 'domains/run/types';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { RunsTable } from '@web-app/components/runs-table';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function checkHasRunningRun(runs: RunRecord[] = []): boolean {
  return runs.some(isMatching({ status: 'running' }));
}

export function RunsPage() {
  useDocumentTitle('Runs');
  const { data, error, isPending } = useQuery({
    queryKey: ['runs'],
    queryFn: () => getRuns(sameOriginApi, RECENT_RUNS_LIMIT),
    refetchInterval: query => getPollInterval(checkHasRunningRun(query.state.data)),
  });

  return (
    <div>
      <PageHeader.Root
        title="Runs"
        aside={data && <PageHeader.Aside>{data.length} runs</PageHeader.Aside>}
      />
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <Card.Root className="gap-0 overflow-visible py-0">
          <RunsTable runs={data} hasRoutineColumn />
        </Card.Root>
      )}
    </div>
  );
}
