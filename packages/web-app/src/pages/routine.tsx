import { useRef, type RefObject } from 'react';
import { useLocation, useParams } from 'react-router';
import { isMatching, P } from 'ts-pattern';
import {
  Card,
  ErrorState,
  LoadingState,
  Markdown,
  Tabs,
  PageHeader,
  SectionHeader,
} from 'design-system';
import { checkHasAccount } from 'domains/agent/utils';
import { checkHasSeveralAccounts } from 'domains/daemon/utils';
import { routineNameSchema, type RoutineName } from 'domains/routine/ids';
import type { RoutineDetail } from 'domains/routine/types';
import { useDaemonStatus } from '@web-app/domains/daemon/queries';
import { NotifyMenu } from '@web-app/domains/inbox/notify-menu';
import { AddedRoutineNotice } from '@web-app/domains/routine/added-routine-notice';
import { ChangePromptMenuItem } from '@web-app/domains/routine/change-prompt-menu-item';
import { MemoryPanel } from '@web-app/domains/routine/memory-panel';
import { OneTimeRunsTable } from '@web-app/domains/routine/one-time-runs-table';
import { useRoutine } from '@web-app/domains/routine/queries';
import { QueuedRunsSection } from '@web-app/domains/routine/queued-runs-section';
import { RoutineBadges } from '@web-app/domains/routine/routine-badges';
import { RoutineDetailList } from '@web-app/domains/routine/routine-detail-list';
import { RunNowButton } from '@web-app/domains/routine/run-now-button';
import { WebhookQueueButton } from '@web-app/domains/routine/webhook-queue-button';
import { useRuns } from '@web-app/domains/run/queries';
import { RunsList } from '@web-app/domains/run/runs-list';
import { TokenUsageSection } from '@web-app/domains/run/token-usage-section';
import { SkipsTable } from '@web-app/domains/scheduler/skips-table';
import { WebhookCallsList } from '@web-app/domains/webhook/webhook-calls-list';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useTabSearchParam } from '@web-app/hooks/use-tab-search-param';
import { Breadcrumbs } from '@web-app/layout/breadcrumbs';
import { ROUTINES_PATH } from '@web-app/paths';

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
  const { data: status } = useDaemonStatus();
  const hasAccount =
    checkHasAccount(routine.agent) &&
    (routine.account !== null || (status !== undefined && checkHasSeveralAccounts(status)));
  const memory = routine.memoryNotes;
  const [tab, setTab] = useTabSearchParam([
    'runs',
    'prompt',
    ...(memory === null ? [] : ['memory' as const]),
    ...(routine.webhook ? ['webhooks' as const] : []),
  ]);
  return (
    <div className="space-y-10">
      <Card.Root>
        <RoutineDetailList routine={routine} hasAccount={hasAccount} />
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
              <Card.Root className="overflow-visible">
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
              <Card.Root className="overflow-visible">
                <SkipsTable skips={routine.skips} />
              </Card.Root>
            </section>
          )}
        </Tabs.Content>
        <Tabs.Content value="prompt">
          <Card.Root className="p-6">
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
            <Card.Root>
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
  const state: unknown = useLocation().state;
  const addedFile = isMatching({ addedFile: P.string }, state) ? state.addedFile : null;
  const { data, error, isPending } = useRoutine(name, { isPolling: true });

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
                runs={data.runs}
                isRunning={data.running}
                menu={<ChangePromptMenuItem routine={data.name} />}
              />
            </div>
          )
        }
      />
      <RoutineHeader name={name} routine={data} />
      {addedFile !== null && <AddedRoutineNotice file={addedFile} />}
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && <RoutineView routine={data} runNowRef={runNowRef} />}
    </div>
  );
}
