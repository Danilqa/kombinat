import { useParams } from 'react-router';
import { Card, ErrorState, LoadingState, Markdown, Tabs } from 'design-system/components';
import { PageHeader, SectionHeader } from 'design-system/layouts';
import { RoutineBadges, RoutineDetailList, RunNowButton } from 'domains/routine/components';
import { getRoutine } from 'domains/routine/requests';
import type { RoutineDetail } from 'domains/routine/types';
import { SkipsTable } from 'domains/scheduler/components';
import { usePolledData } from 'utils/hooks/use-polled-data';
import { sameOriginApi } from 'utils/http';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RunsTable } from '@web-app/components/runs-table';
import { ROUTINES_PATH } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function getIsRoutineRunning(routine: RoutineDetail): boolean {
  return routine.running;
}

interface RoutineHeaderProps {
  name: string;
  routine: RoutineDetail | null;
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
  const { data, error, reload } = usePolledData(
    `routine/${name}`,
    () => getRoutine(sameOriginApi, name),
    getIsRoutineRunning,
  );

  return (
    <div>
      <Breadcrumbs
        crumbs={[{ label: 'Routines', to: ROUTINES_PATH }]}
        aside={
          data && <RunNowButton routine={data.name} isRunning={data.running} onStarted={reload} />
        }
      />
      <RoutineHeader name={name} routine={data} />
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && <RoutineView routine={data} />}
    </div>
  );
}
