import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Card, ErrorState, LoadingState, Markdown, Tabs } from 'design-system/components';
import { PageHeader, SectionHeader } from 'design-system/layouts';
import {
  RoutineBadges,
  RoutineDetailList,
  RunNowButton,
  WebhookQueueButton,
} from 'domains/routine/components';
import { getRoutine } from 'domains/routine/requests';
import type { RoutineDetail } from 'domains/routine/types';
import { SkipsTable } from 'domains/scheduler/components';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RunsTable } from '@web-app/components/runs-table';
import { ROUTINES_PATH } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function checkIsRoutineRunning(routine: RoutineDetail | undefined): boolean {
  return routine?.running === true;
}

interface RoutineHeaderProps {
  name: string;
  routine: RoutineDetail | undefined;
}

// The title comes from the route, so the page has its heading while loading and on errors too.
function RoutineHeader({ name, routine }: RoutineHeaderProps) {
  return (
    <header className="mb-6 min-w-0 space-y-3">
      <div className="space-y-1">
        <PageHeader.Title>{name}</PageHeader.Title>
        {routine?.description && (
          <p className="max-w-3xl text-body text-fg-secondary">{routine.description}</p>
        )}
      </div>
      {routine && <RoutineBadges routine={routine} />}
    </header>
  );
}

interface RoutineViewProps {
  routine: RoutineDetail;
}

function RoutineView({ routine }: RoutineViewProps) {
  return (
    <div className="space-y-10">
      <Card.Root className="gap-0 py-0">
        <RoutineDetailList routine={routine} />
      </Card.Root>
      <Tabs.Root defaultValue="runs" className="gap-4">
        <Tabs.List>
          <Tabs.Trigger value="runs">
            Runs
            <span className="text-fg-secondary tabular-nums">{routine.runs.length}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="prompt">Prompt</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="runs" className="space-y-10">
          <Card.Root className="gap-0 overflow-visible py-0">
            <RunsTable runs={routine.runs} hasRoutineColumn={false} />
          </Card.Root>
          {routine.skips.length > 0 && (
            <section>
              <SectionHeader.Root
                aside={<SectionHeader.Aside>{routine.skips.length} skipped</SectionHeader.Aside>}
              >
                Skipped runs
              </SectionHeader.Root>
              <Card.Root className="gap-0 overflow-visible py-0">
                <SkipsTable skips={routine.skips} />
              </Card.Root>
            </section>
          )}
        </Tabs.Content>
        <Tabs.Content value="prompt">
          <Card.Root className="gap-0 p-6">
            <Markdown source={routine.prompt} minHeadingLevel={2} />
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export function RoutinePage() {
  const { name = '' } = useParams();
  useDocumentTitle(name);
  const { data, error, isPending } = useQuery({
    queryKey: ['routines', name],
    queryFn: () => getRoutine(sameOriginApi, name),
    refetchInterval: query => getPollInterval(checkIsRoutineRunning(query.state.data)),
  });

  return (
    <div>
      <Breadcrumbs
        crumbs={[{ label: 'Routines', to: ROUTINES_PATH }]}
        aside={
          data && (
            <div className="flex items-center gap-2">
              <WebhookQueueButton routine={data.name} count={data.queuedWebhooks} />
              <RunNowButton routine={data.name} isRunning={data.running} />
            </div>
          )
        }
      />
      <RoutineHeader name={name} routine={data} />
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && <RoutineView routine={data} />}
    </div>
  );
}
