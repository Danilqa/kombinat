import { useParams } from 'react-router';
import { isMatching } from 'ts-pattern';
import { CodeBlock } from '@/components/code-block';
import { DetailList, type DetailEntry } from '@/components/detail-list';
import { Markdown } from '@/components/markdown';
import { Breadcrumbs, PageTitle, SectionAside, SectionTitle } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/page-states';
import { RelativeTime } from '@/components/relative-time';
import { StatusBadge, getTriggerLabel } from '@/components/status-badge';
import { Transcript } from '@/components/transcript';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getRun, getRunTranscript } from '@/lib/api';
import type { RunRecord, Transcript as RunTranscript } from '@/lib/api';
import { formatDuration, getRunDurationMs, formatShort } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { usePolledData } from '@/lib/use-polled-data';

interface RunWithTranscript {
  run: RunRecord;
  transcript: RunTranscript;
}

async function loadRun(routine: string, id: string): Promise<RunWithTranscript> {
  const [run, transcript] = await Promise.all([getRun(routine, id), getRunTranscript(routine, id)]);
  return { run, transcript };
}

function getIsRunActive(data: RunWithTranscript): boolean {
  return isMatching({ status: 'running' }, data.run);
}

function formatOptionalTime(iso: string | null) {
  return iso ? (
    <span className="tabular-nums">
      {formatShort(iso)} <RelativeTime iso={iso} className="ml-1 text-fg-muted" />
    </span>
  ) : (
    '-'
  );
}

function getSummaryEntries(run: RunRecord): DetailEntry[] {
  return [
    { label: 'Trigger', value: getTriggerLabel(run.trigger) },
    ...(run.scheduledFor
      ? [{ label: 'Scheduled for', value: formatOptionalTime(run.scheduledFor) }]
      : []),
    { label: 'Started', value: formatOptionalTime(run.startedAt) },
    { label: 'Ended', value: formatOptionalTime(run.endedAt) },
    { label: 'Duration', value: formatDuration(getRunDurationMs(run)) },
    { label: 'Turns', value: run.numTurns ?? '-' },
    { label: 'Agent', value: run.agent, isMono: true },
    { label: 'Model', value: run.model ?? '-', isMono: true },
    { label: 'Session', value: run.sessionId ?? '-', isMono: true, span: 'wide' },
    ...(run.resumeCommand === null
      ? []
      : [{ label: 'Resume', value: run.resumeCommand, isMono: true, span: 'wide' as const }]),
    { label: 'Exit code', value: run.exitCode ?? '-', isMono: true },
    { label: 'PID', value: run.pid ?? '-', isMono: true },
    { label: 'Log', value: run.logFile, isMono: true, span: 'full' },
  ];
}

interface RunViewProps extends RunWithTranscript {}

function RunView({ run, transcript }: RunViewProps) {
  const isRunning = isMatching({ status: 'running' }, run);
  const hasOutput = Boolean(run.error) || Boolean(run.resultText);
  return (
    <div className="space-y-10">
      <Card className="gap-0 py-0">
        <DetailList entries={getSummaryEntries(run)} />
        {hasOutput && (
          <>
            <Separator />
            <div className="space-y-4 p-4">
              {run.error && (
                <div>
                  <div className="eyebrow mb-2">Error</div>
                  <CodeBlock
                    label="Run error"
                    className="max-h-80 border-transparent bg-negative-soft text-negative"
                  >
                    {run.error}
                  </CodeBlock>
                </div>
              )}
              {run.error && run.resultText && <Separator />}
              {run.resultText && (
                <div>
                  <div className="eyebrow mb-2">Result</div>
                  <Markdown source={run.resultText} minHeadingLevel={2} />
                </div>
              )}
            </div>
          </>
        )}
      </Card>
      <section>
        <SectionTitle aside={<SectionAside>{transcript.eventCount} events</SectionAside>}>
          Transcript
        </SectionTitle>
        <Transcript items={transcript.items} isRunning={isRunning} />
      </section>
    </div>
  );
}

export function RunPage() {
  const { routine = '', id = '' } = useParams();
  useDocumentTitle(`${routine} run ${id}`);
  const { data, error } = usePolledData(
    `run/${routine}/${id}`,
    () => loadRun(routine, id),
    getIsRunActive,
  );

  return (
    <div>
      <Breadcrumbs
        crumbs={[
          { label: 'Runs', to: '/runs' },
          { label: routine, to: `/routines/${encodeURIComponent(routine)}` },
        ]}
      />
      {/* The title comes from the route, so the page has its heading while loading and on errors too. */}
      <header className="mb-6 flex max-w-full flex-wrap items-center gap-3">
        <PageTitle className="max-w-full font-mono">{id}</PageTitle>
        {data && <StatusBadge status={data.run.status} />}
      </header>
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && <RunView run={data.run} transcript={data.transcript} />}
    </div>
  );
}
