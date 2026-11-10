import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { isMatching } from 'ts-pattern';
import { Card, ErrorState, LoadingState, Separator } from 'design-system/components';
import { PageHeader, SectionHeader } from 'design-system/layouts';
import { routineNameSchema, runIdSchema } from 'domains/id/schemas';
import { RunDetailList, RunOutput, RunStatusBadge } from 'domains/run/components';
import { getRunWithTranscript } from 'domains/run/requests';
import type { RunWithTranscript } from 'domains/run/types';
import { TranscriptList } from 'domains/transcript/components';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RUNS_PATH, getRoutinePath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function checkIsRunActive(data: RunWithTranscript | undefined): boolean {
  return isMatching({ run: { status: 'running' } }, data);
}

interface RunViewProps extends RunWithTranscript {}

function RunView({ run, transcript }: RunViewProps) {
  const isRunning = isMatching({ status: 'running' }, run);
  const hasOutput = Boolean(run.error) || Boolean(run.resultText);
  return (
    <div className="space-y-10">
      <Card.Root className="gap-0 py-0">
        <RunDetailList run={run} />
        {hasOutput && (
          <>
            <Separator />
            <RunOutput run={run} />
          </>
        )}
      </Card.Root>
      <section>
        <SectionHeader.Root
          aside={<SectionHeader.Aside>{transcript.eventCount} events</SectionHeader.Aside>}
        >
          Transcript
        </SectionHeader.Root>
        <TranscriptList items={transcript.items} isRunning={isRunning} />
      </section>
    </div>
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
    refetchInterval: query => getPollInterval(checkIsRunActive(query.state.data)),
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
