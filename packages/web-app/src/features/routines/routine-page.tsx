import { useQuery } from '@tanstack/react-query';
import { useRef, type RefObject } from 'react';
import { useParams } from 'react-router';
import { Card, ErrorState, LoadingState, Markdown, Tabs } from 'design-system/components';
import { PageHeader, SectionHeader } from 'design-system/layouts';
import {
  RoutineBadges,
  RoutineDetailList,
  RunNowButton,
  WebhookQueueButton,
} from 'domains/routine/components';
import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import { getRoutine } from 'domains/routine/requests';
import type { RoutineDetail } from 'domains/routine/types';
import { SkipsTable } from 'domains/scheduler/components';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RunsList } from '@web-app/components/runs-list';
import { ROUTINES_PATH } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useRuns } from '@web-app/hooks/use-runs';
import { useTabSearchParam } from '@web-app/hooks/use-tab-search-param';
import { ChangePromptMenuItem } from './change-prompt-menu-item';
import { MemoryPanel } from './memory-panel';
import { NotifyMenu } from './notify-menu';
import { OneTimeRunsTable } from './one-time-runs-table';
import { QueuedRunsSection } from './queued-runs-section';
import { TokenUsageSection } from './token-usage-section';
import { WebhookCallsList } from './webhook-calls-list';

interface OneTimeRunsNoteProps {
  count: number;
}

// Phones drop the middle, so the note stays on the heading's line.
function OneTimeRunsNote({ count }: OneTimeRunsNoteProps) {
  return (
    <SectionHeader.Aside>
      {count} {count === 1 ? 'run' : 'runs'},{' '}
      <span className="max-sm:hidden">kept on this machine, </span>
      not in git
    </SectionHeader.Aside>
  );
}

function checkIsRoutineRunning(routine: RoutineDetail | undefined): boolean {
  return routine?.running === true;
}

interface RoutineHeaderProps {
  name: RoutineName;
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
  runNowRef: RefObject<HTMLButtonElement | null>;
}

function RoutineView({ routine, runNowRef }: RoutineViewProps) {
  const runs = useRuns(routine.name, routine.lastRun);
  const memory = routine.memoryNotes;
  const [tab, setTab] = useTabSearchParam([
    'runs',
    'prompt',
    ...(memory === null ? [] : ['memory' as const]),
    ...(routine.webhook ? ['webhooks' as const] : []),
  ]);
  return (
    <div className="space-y-10">
      <Card.Root className="gap-0 py-0">
        <RoutineDetailList routine={routine} />
      </Card.Root>
      {routine.tokenUsage && <TokenUsageSection usage={routine.tokenUsage} />}
      <Tabs.Root value={tab} onValueChange={setTab} className="gap-4">
        {/* Four tabs with long counts are wider than a phone, so the last one wraps. */}
        <Tabs.List className="flex-wrap">
          <Tabs.Trigger value="runs">
            Runs
            {runs.data && <span className="text-fg-secondary tabular-nums">{runs.data.total}</span>}
          </Tabs.Trigger>
          <Tabs.Trigger value="prompt">Prompt</Tabs.Trigger>
          {memory !== null && <Tabs.Trigger value="memory">Memory</Tabs.Trigger>}
          {routine.webhook && (
            <Tabs.Trigger value="webhooks">
              Webhooks
              <span className="text-fg-secondary tabular-nums">{routine.webhookCalls.length}</span>
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Content value="runs" className="space-y-10">
          <QueuedRunsSection
            routine={routine.name}
            queuedRuns={routine.queuedRuns}
            runNowRef={runNowRef}
          />
          {routine.oneTimeRuns.length > 0 && (
            <section>
              <SectionHeader.Root aside={<OneTimeRunsNote count={routine.oneTimeRuns.length} />}>
                Scheduled once
              </SectionHeader.Root>
              <Card.Root className="gap-0 overflow-visible py-0">
                <OneTimeRunsTable
                  routine={routine.name}
                  oneTimeRuns={routine.oneTimeRuns}
                  runNowRef={runNowRef}
                />
              </Card.Root>
            </section>
          )}
          <RunsList runs={runs} hasRoutineColumn={false} />
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
        {memory !== null && (
          // Kept mounted, so long notes render once in the background and the tab opens at once.
          <Tabs.Content value="memory" forceMount className="data-[state=inactive]:hidden">
            <MemoryPanel
              routine={routine.name}
              memory={memory}
              lastRunId={routine.lastRun?.id ?? null}
              isRunning={routine.running}
            />
          </Tabs.Content>
        )}
        {routine.webhook && (
          <Tabs.Content value="webhooks">
            <Card.Root className="gap-0 py-0">
              <WebhookCallsList routine={routine.name} calls={routine.webhookCalls} />
            </Card.Root>
          </Tabs.Content>
        )}
      </Tabs.Root>
    </div>
  );
}

export function RoutinePage() {
  const name = routineNameSchema.parse(useParams<'name'>().name ?? '');
  useDocumentTitle(name);
  const runNowRef = useRef<HTMLButtonElement>(null);
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
            <div className="flex min-w-0 items-center gap-2">
              <WebhookQueueButton routine={data.name} count={data.queuedWebhooks} />
              <NotifyMenu routine={data.name} />
              <RunNowButton
                ref={runNowRef}
                routine={data.name}
                isRunning={data.running}
                menu={<ChangePromptMenuItem routine={data.name} />}
              />
            </div>
          )
        }
      />
      <RoutineHeader name={name} routine={data} />
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && <RoutineView routine={data} runNowRef={runNowRef} />}
    </div>
  );
}
