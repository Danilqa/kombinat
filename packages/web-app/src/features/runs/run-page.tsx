import { useParams } from 'react-router';
import { isMatching } from 'ts-pattern';
import { Card } from 'design-system/components/card';
import { ErrorState, LoadingState } from 'design-system/components/page-states';
import { Separator } from 'design-system/components/separator';
import { PageTitle, SectionAside, SectionTitle } from 'design-system/layouts/page-header';
import { RunDetailList, RunOutput, RunStatusBadge } from 'domains/run/components';
import { getRunWithTranscript } from 'domains/run/requests';
import type { RunWithTranscript } from 'domains/run/types';
import { TranscriptList } from 'domains/transcript/components';
import { usePolledData } from 'utils/hooks/use-polled-data';
import { sameOriginApi } from 'utils/http';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RUNS_PATH, getRoutinePath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function getIsRunActive(data: RunWithTranscript): boolean {
  return isMatching({ status: 'running' }, data.run);
}

interface RunViewProps extends RunWithTranscript {}

function RunView({ run, transcript }: RunViewProps) {
  const isRunning = isMatching({ status: 'running' }, run);
  const hasOutput = Boolean(run.error) || Boolean(run.resultText);
  return (
    <div className="space-y-10">
      <Card className="gap-0 py-0">
        <RunDetailList run={run} />
        {hasOutput && (
          <>
            <Separator />
            <RunOutput run={run} />
          </>
        )}
      </Card>
      <section>
        <SectionTitle aside={<SectionAside>{transcript.eventCount} events</SectionAside>}>
          Transcript
        </SectionTitle>
        <TranscriptList items={transcript.items} isRunning={isRunning} />
      </section>
    </div>
  );
}

export function RunPage() {
  const { routine = '', id = '' } = useParams();
  useDocumentTitle(`${routine} run ${id}`);
  const { data, error } = usePolledData(
    `run/${routine}/${id}`,
    () => getRunWithTranscript(sameOriginApi, routine, id),
    getIsRunActive,
  );

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
        <PageTitle className="max-w-full font-mono">{id}</PageTitle>
        {data && <RunStatusBadge status={data.run.status} />}
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && <RunView run={data.run} transcript={data.transcript} />}
    </div>
  );
}
