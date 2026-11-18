import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Card, ErrorState, LoadingState, Separator, Tabs } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { routineNameSchema } from 'domains/routine/ids';
import { RunDetailList, RunOutput, RunStatusBadge } from 'domains/run/components';
import { runIdSchema } from 'domains/run/ids';
import { getRunWithTranscript } from 'domains/run/requests';
import type { RunWithTranscript } from 'domains/run/types';
import { checkIsRunActive } from 'domains/run/utils';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RUNS_PATH, getRoutinePath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { RunChat } from './run-chat';

interface RunViewProps extends RunWithTranscript {}

function RunView({ run, transcript }: RunViewProps) {
  const hasOutput = Boolean(run.error) || Boolean(run.resultText);
  return (
    <Tabs.Root defaultValue="information" className="gap-4">
      <Tabs.List>
        <Tabs.Trigger value="information">Information</Tabs.Trigger>
        <Tabs.Trigger value="transcript">
          Transcript & chat
          <span className="text-fg-secondary tabular-nums">{transcript.eventCount}</span>
        </Tabs.Trigger>
      </Tabs.List>
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
        <RunChat run={run} transcript={transcript} />
      </Tabs.Content>
    </Tabs.Root>
  );
}

export function RunPage() {
  const params = useParams<'routine' | 'id'>();
  const routine = routineNameSchema.parse(params.routine ?? '');
  const id = runIdSchema.parse(params.id ?? '');
  useDocumentTitle(`${routine} run ${id}`);
  const { data, error, isPending } = useQuery({
    queryKey: ['runs', routine, id],
    queryFn: () => getRunWithTranscript(sameOriginApi, routine, id),
    refetchInterval: query =>
      getPollInterval(query.state.data !== undefined && checkIsRunActive(query.state.data.run)),
  });

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
      </header>
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && <RunView run={data.run} transcript={data.transcript} />}
    </div>
  );
}
