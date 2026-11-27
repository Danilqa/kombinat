import { Card, ErrorState, LoadingState } from 'design-system';
import type { RunsQuery } from '../queries';
import { RunsTable } from '../runs-table';

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
        <Card.Root className="overflow-visible">
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
