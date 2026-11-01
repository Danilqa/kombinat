import { Link, useParams } from 'react-router';
import { isMatching } from 'ts-pattern';
import { DetailList, type DetailEntry } from '@/components/detail-list';
import { Markdown } from '@/components/markdown';
import { Breadcrumbs, PageTitle, SectionAside, SectionTitle } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/page-states';
import { RelativeTime } from '@/components/relative-time';
import { StatusBadge, getTriggerLabel } from '@/components/status-badge';
import { Transcript } from '@/components/transcript';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getRun, getRunTranscript } from '@/lib/api';
import type { RunRecord, Transcript as RunTranscript } from '@/lib/api';
import { formatDuration, getRunDurationMs, formatShort } from '@/lib/format';
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
    <span>
      {formatShort(iso)} <RelativeTime iso={iso} className="ml-1 text-grey-60" />
    </span>
  ) : (
    '-'
  );
}

function getSummaryEntries(run: RunRecord): DetailEntry[] {
  return [
    { label: 'Status', value: <StatusBadge status={run.status} /> },
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
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PageTitle className="font-mono font-medium tracking-normal">{run.id}</PageTitle>
        <Link
          to={`/routines/${encodeURIComponent(run.routine)}`}
          className="text-title-16 text-grey-70 hover:text-black hover:underline"
        >
          {run.routine}
        </Link>
      </header>
      <Card className="py-6">
        <CardContent className="space-y-6 px-6">
          <DetailList entries={getSummaryEntries(run)} layout="grid" />
          {run.error && (
            <pre className="rounded-8 bg-light-red-20 p-3 font-mono text-paragraph-12 whitespace-pre-wrap text-dark-red">
              {run.error}
            </pre>
          )}
          {run.resultText && (
            <>
              <Separator />
              <div>
                <div className="eyebrow mb-2">Result</div>
                <Markdown source={run.resultText} />
              </div>
            </>
          )}
        </CardContent>
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
  const { data, error } = usePolledData(
    `run/${routine}/${id}`,
    () => loadRun(routine, id),
    getIsRunActive,
  );

  return (
    <div>
      <Breadcrumbs
        crumbs={[{ label: routine, to: `/routines/${encodeURIComponent(routine)}` }, { label: id }]}
      />
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && <RunView run={data.run} transcript={data.transcript} />}
    </div>
  );
}
