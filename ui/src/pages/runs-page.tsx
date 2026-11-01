import { isMatching } from 'ts-pattern';
import { PageHeader, SectionAside } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/page-states';
import { RunsTable } from '@/components/runs-table';
import { Card } from '@/components/ui/card';
import { getRuns, type RunRecord } from '@/lib/api';
import { useDocumentTitle } from '@/lib/use-document-title';
import { usePolledData } from '@/lib/use-polled-data';

const RUNS_LIMIT = 50;

function loadRuns(): Promise<RunRecord[]> {
  return getRuns(RUNS_LIMIT);
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
        <Card className="gap-0 py-0">
          <RunsTable runs={data} hasRoutineColumn />
        </Card>
      )}
    </div>
  );
}
