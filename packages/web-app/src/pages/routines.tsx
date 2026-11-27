import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, ErrorState, LoadingState, PageHeader } from 'design-system';
import { useCustomization } from '@web-app/customization';
import { useRoutines } from '@web-app/domains/routine/queries';
import { RoutinesTable } from '@web-app/domains/routine/routines-table';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { TEMPLATES_PATH } from '@web-app/paths';

export function RoutinesPage() {
  useDocumentTitle('Routines');
  const { routinesTitle = 'Routines' } = useCustomization();
  const { data, error, isPending } = useRoutines({ isPolling: true });

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
          // An icon on phones keeps the button on the title's line.
          <Button asChild size="small" className="tap-area max-sm:size-7 max-sm:px-0">
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
        <Card.Root className="overflow-visible">
          <RoutinesTable routines={data} />
        </Card.Root>
      )}
    </div>
  );
}
