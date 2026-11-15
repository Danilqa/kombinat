import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { getRoutines } from 'domains/routine/requests';
import type { RoutineSummary } from 'domains/routine/types';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { RoutinesTable } from './routines-table';

function checkHasRunningRoutine(routines: RoutineSummary[] = []): boolean {
  return routines.some(routine => routine.running);
}

interface RoutinesPageProps {
  title: string;
}

export function RoutinesPage({ title }: RoutinesPageProps) {
  useDocumentTitle('Routines');
  const { data, error, isPending } = useQuery({
    queryKey: ['routines'],
    queryFn: () => getRoutines(sameOriginApi),
    refetchInterval: query => getPollInterval(checkHasRunningRoutine(query.state.data)),
  });

  return (
    <div>
      <PageHeader.Root
        title={title}
        aside={data && <PageHeader.Aside>{data.length} routines</PageHeader.Aside>}
      />
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <Card.Root className="gap-0 overflow-visible py-0">
          <RoutinesTable routines={data} />
        </Card.Root>
      )}
    </div>
  );
}
