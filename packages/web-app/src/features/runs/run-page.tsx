import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { isMatching, P } from 'ts-pattern';
import { Button, Card, ErrorState, LoadingState, Separator, Tabs } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { routineNameSchema } from 'domains/routine/ids';
import {
  BlockedActionsCard,
  BlockedBadge,
  RetryCard,
  RunDetailList,
  RunOutput,
  RunStatusBadge,
  UsageLimitCard,
  WorktreeCard,
} from 'domains/run/components';
import { runIdSchema } from 'domains/run/ids';
import { getRunWithTranscript } from 'domains/run/requests';
import type { RunWithTranscript } from 'domains/run/types';
import { checkIsRunActive, getCheckoutCwd } from 'domains/run/utils';
import type { Transcript } from 'domains/transcript/types';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RUNS_PATH, getRoutinePath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useMarkRunsRead } from '@web-app/hooks/use-mark-runs-read';
import { useTabSearchParam } from '@web-app/hooks/use-tab-search-param';
import { RunChat } from './run-chat';

// A run writes its record once its before hook is done, which takes up to three minutes.
const START_RETRIES = 200;
const START_RETRY_MS = 1000;
const TABS = ['information', 'transcript'] as const;

function getAgentCwd(transcript: Transcript): string | null {
  const init = transcript.items.find(item => isMatching({ kind: 'init' }, item));
  return isMatching({ kind: 'init', cwd: P.string }, init) ? init.cwd : null;
}

interface RunViewProps extends RunWithTranscript {}

function RunView({ run, transcript }: RunViewProps) {
  const hasOutput = Boolean(run.error) || Boolean(run.resultText);
  const [tab, setTab] = useTabSearchParam(TABS);
  const [searchValue, setSearchValue] = useState<string | null>(null);
  const isSearchOpen = searchValue !== null;
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const canSearch = isMatching('transcript', tab) && transcript.items.length > 0;

  function handleTabChange(value: string) {
    setTab(value);
    setSearchValue(null);
  }

  function handleSearchClose() {
    setSearchValue(null);
    searchButtonRef.current?.focus();
  }

  return (
    <Tabs.Root value={tab} onValueChange={handleTabChange} className="gap-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs.List>
          <Tabs.Trigger value="information">Information</Tabs.Trigger>
          <Tabs.Trigger value="transcript">
            Transcript & chat
            <span className="text-fg-secondary tabular-nums">{transcript.eventCount}</span>
          </Tabs.Trigger>
        </Tabs.List>
        {canSearch && (
          <Button
            ref={searchButtonRef}
            variant="tertiary"
            size="icon-small"
            className="max-sm:-my-0.5 max-sm:size-9"
            isActive={isSearchOpen}
            aria-expanded={isSearchOpen}
            onClick={() => (isSearchOpen ? handleSearchClose() : setSearchValue(''))}
          >
            <Search aria-hidden="true" />
            <span className="sr-only">Search the transcript</span>
          </Button>
        )}
      </div>
      <Tabs.Content value="information">
        <Card.Root className="gap-0 py-0">
          <RunDetailList run={run} />
          {hasOutput && (
            <>
              <Separator />
              <RunOutput run={run} />
            </>
          )}
        </Card.Root>
      </Tabs.Content>
      <Tabs.Content value="transcript">
        <RunChat
          run={run}
          transcript={transcript}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          onSearchClose={handleSearchClose}
        />
      </Tabs.Content>
    </Tabs.Root>
  );
}

export function RunPage() {
  const params = useParams<'routine' | 'id'>();
  const routine = routineNameSchema.parse(params.routine ?? '');
  const id = runIdSchema.parse(params.id ?? '');
  const isStarting = isMatching({ isStarting: true }, useLocation().state);
  const [, setTab] = useTabSearchParam(TABS);
  useDocumentTitle(`${routine} run ${id}`);
  const { data, error, isPending } = useQuery({
    queryKey: ['runs', routine, id],
    queryFn: () => getRunWithTranscript(sameOriginApi, routine, id),
    refetchInterval: query =>
      getPollInterval(query.state.data !== undefined && checkIsRunActive(query.state.data.run)),
    retry: isStarting && START_RETRIES,
    retryDelay: START_RETRY_MS,
  });
  const { mutate: markRunsRead } = useMarkRunsRead();
  const isFinished = data !== undefined && !checkIsRunActive(data.run);
  useEffect(() => {
    if (isFinished) markRunsRead([{ routine, id }]);
  }, [isFinished, routine, id, markRunsRead]);

  return (
    <div>
      <Breadcrumbs
        crumbs={[
          { label: 'Runs', to: RUNS_PATH },
          { label: routine, to: getRoutinePath(routine) },
        ]}
      />
      {/* The title comes from the route, so the page has its heading while loading and on errors too. */}
      <header className="mb-6 flex max-w-full flex-wrap items-center gap-3">
        <PageHeader.Title className="max-w-full font-mono">{id}</PageHeader.Title>
        {data && <RunStatusBadge status={data.run.status} />}
        {data && data.run.blockedActions.length > 0 && (
          <BlockedBadge count={data.run.blockedActions.length} />
        )}
      </header>
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && data.run.usageLimit !== null && (
        <UsageLimitCard
          key={data.run.usageLimit.stoppedAt}
          run={data.run}
          wait={data.run.usageLimit}
        />
      )}
      {data && data.run.retry !== null && (
        <RetryCard key={data.run.retry.stoppedAt} run={data.run} retry={data.run.retry} />
      )}
      {data && data.run.blockedActions.length > 0 && (
        <BlockedActionsCard
          run={data.run}
          cwd={
            data.run.worktree === null
              ? getAgentCwd(data.transcript)
              : getCheckoutCwd(data.run.worktree)
          }
          onAllowed={() => setTab('transcript')}
        />
      )}
      {data && data.run.worktree !== null && (
        <WorktreeCard run={data.run} worktree={data.run.worktree} />
      )}
      {data && <RunView run={data.run} transcript={data.transcript} />}
    </div>
  );
}
