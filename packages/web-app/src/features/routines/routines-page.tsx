import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { getRoutines } from 'domains/routine/requests';
import type { RoutineSummary } from 'domains/routine/types';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { TEMPLATES_PATH } from '@web-app/constants/path';
import { useCustomization } from '@web-app/contexts';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { RoutinesTable } from './routines-table';

function checkHasRunningRoutine(routines: RoutineSummary[] = []): boolean {
  return routines.some(routine => routine.running);
}

export function RoutinesPage() {
  useDocumentTitle('Routines');
  const { routinesTitle = 'Routines' } = useCustomization();
  const { data, error, isPending } = useQuery({
    queryKey: ['routines'],
    queryFn: () => getRoutines(sameOriginApi),
    refetchInterval: query => getPollInterval(checkHasRunningRoutine(query.state.data)),
  });

  return (
    <div>
      <PageHeader.Root
        title={routinesTitle}
        count={
          data && (
            <>
              {data.length}
              <span className="sr-only"> {data.length === 1 ? 'routine' : 'routines'}</span>
            </>
          )
        }
        aside={
          // An icon on phones keeps the button on the title's line, with a 44px tap area.
          <Button
            asChild
            size="small"
            className="relative max-sm:size-7 max-sm:px-0 max-sm:after:absolute max-sm:after:-inset-2"
          >
            <Link to={TEMPLATES_PATH}>
              <Plus aria-hidden="true" />
              <span className="max-sm:sr-only">New routine</span>
            </Link>
          </Button>
        }
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
