import { Card, ErrorState, LoadingState } from 'design-system/components';
import { RunsTable } from '@web-app/components/runs-table';
import type { RunsQuery } from '@web-app/hooks/use-runs';

interface RunsListProps {
  runs: RunsQuery;
  hasRoutineColumn: boolean;
}

export function RunsList({ runs, hasRoutineColumn }: RunsListProps) {
  const { data, error, isPending, isFetchingNextPage, loadNextPage } = runs;
  return (
    <div>
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <Card.Root className="gap-0 overflow-visible py-0">
          <RunsTable
            runs={data.runs}
            total={data.total}
            hasRoutineColumn={hasRoutineColumn}
            onEndReached={loadNextPage}
          />
        </Card.Root>
      )}
      {isFetchingNextPage && <LoadingState />}
    </div>
  );
}
