import { useQuery } from '@tanstack/react-query';
import { Card, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { getRoutines } from 'domains/routine/requests';
import type { RoutineSummary } from 'domains/routine/types';
import { formatTokens, getTokenTotal } from 'domains/run/utils';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { useCustomization } from '@web-app/contexts';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { RoutinesTable } from './routines-table';

function getAllTokens(routines: RoutineSummary[]): number | null {
  const usages = routines.flatMap(({ tokenUsage }) => (tokenUsage ? [tokenUsage] : []));
  if (usages.length === 0) return null;
  return usages.reduce((sum, usage) => sum + getTokenTotal(usage.counts), 0);
}

interface RoutinesNoteProps {
  routines: RoutineSummary[];
}

// Phones keep only the count, so the note stays on the title's line.
function RoutinesNote({ routines }: RoutinesNoteProps) {
  const allTokens = getAllTokens(routines);
  return (
    <PageHeader.Aside>
      {allTokens !== null && (
        <span className="mr-3 max-sm:hidden">
          All routines used {formatTokens(allTokens)} tokens in the last 7 days
        </span>
      )}
      {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
    </PageHeader.Aside>
  );
}

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
      <PageHeader.Root title={routinesTitle} aside={data && <RoutinesNote routines={data} />} />
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
