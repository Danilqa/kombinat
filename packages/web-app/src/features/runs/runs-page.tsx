import { Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { RunsTable } from '@web-app/components/runs-table';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useRuns } from '@web-app/hooks/use-runs';

export function RunsPage() {
  useDocumentTitle('Runs');
  const { data, error, isPending, isFetchingNextPage, loadNextPage } = useRuns(null);

  return (
    <div>
      <PageHeader.Root
        title="Runs"
        aside={data && <PageHeader.Aside>{data.total} runs</PageHeader.Aside>}
      />
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <Card.Root className="gap-0 overflow-visible py-0">
          <RunsTable
            runs={data.runs}
            total={data.total}
            hasRoutineColumn
            onEndReached={loadNextPage}
          />
        </Card.Root>
      )}
      {isFetchingNextPage && <LoadingState />}
    </div>
  );
}
