import { useParams } from 'react-router';
import { match } from 'ts-pattern';
import { DetailList, type DetailEntry } from '@web-app/components/detail-list';
import { Markdown } from '@web-app/components/markdown';
import {
  Breadcrumbs,
  PageTitle,
  SectionAside,
  SectionTitle,
} from '@web-app/components/page-header';
import { ErrorState, LoadingState } from '@web-app/components/page-states';
import { RelativeTime } from '@web-app/components/relative-time';
import { RunNowButton } from '@web-app/components/run-now-button';
import { RunsTable } from '@web-app/components/runs-table';
import { getSkipReasonLabel } from '@web-app/components/status-badge';
import { Badge, type BadgeVariant } from '@web-app/components/ui/badge';
import { Card } from '@web-app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web-app/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@web-app/components/ui/tabs';
import { getRoutine, type AgentName, type RoutineDetail, type Skip } from '@web-app/lib/api';
import { useDocumentTitle } from '@web-app/lib/use-document-title';
import { usePolledData } from '@web-app/lib/use-polled-data';
import { cn } from '@web-app/lib/utils';

function getIsRoutineRunning(routine: RoutineDetail): boolean {
  return routine.running;
}

type EnabledState = 'enabled' | 'disabled';

interface EnabledBadge {
  label: string;
  variant: BadgeVariant;
  dotClassName: string;
}

const enabledBadges: Record<EnabledState, EnabledBadge> = {
  enabled: { label: 'Enabled', variant: 'positive', dotClassName: 'bg-positive' },
  disabled: { label: 'Disabled', variant: 'ghost', dotClassName: 'bg-fg-faint' },
};

function getAgentLabel(agent: AgentName): string {
  return match(agent)
    .with('claude', () => 'Claude')
    .with('codex', () => 'Codex')
    .with('command', () => 'Command')
    .exhaustive();
}

function getEnabledState(routine: RoutineDetail): EnabledState {
  return match(routine.enabled)
    .with(true, () => 'enabled' as const)
    .with(false, () => 'disabled' as const)
    .exhaustive();
}

interface RoutineBadgesProps {
  routine: RoutineDetail;
}

function RoutineBadges({ routine }: RoutineBadgesProps) {
  const enabledBadge = enabledBadges[getEnabledState(routine)];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge size="small" variant={enabledBadge.variant}>
        <span className={cn('size-1.5 rounded-full', enabledBadge.dotClassName)} />
        {enabledBadge.label}
      </Badge>
      <Badge size="small">{routine.scheduleHuman}</Badge>
      {routine.schedule && (
        <Badge size="small" className="font-mono">
          {routine.schedule}
        </Badge>
      )}
      <Badge size="small">{getAgentLabel(routine.agent)}</Badge>
      {routine.model !== null && (
        <Badge size="small" className="font-mono">
          {routine.model}
        </Badge>
      )}
      {routine.effort !== null && <Badge size="small">Effort {routine.effort}</Badge>}
      {routine.permissionMode !== null && (
        <Badge size="small">Permission {routine.permissionMode}</Badge>
      )}
    </div>
  );
}

function getStatEntries(routine: RoutineDetail): DetailEntry[] {
  return [
    { label: 'Next run', value: <RelativeTime iso={routine.nextRunAt} isFocusable /> },
    {
      label: 'Last run',
      value: <RelativeTime iso={routine.lastRun?.startedAt ?? null} isFocusable />,
    },
    { label: 'Timeout', value: `${routine.timeoutMinutes} min` },
    {
      label: 'Budget',
      value: routine.maxBudgetUsd === null ? 'None' : `$${routine.maxBudgetUsd.toFixed(2)}`,
    },
    { label: 'Working directory', value: routine.cwd, isMono: true, span: 'wide' },
    { label: 'File', value: routine.file, isMono: true, span: 'wide' },
    ...(routine.command === null
      ? []
      : [{ label: 'Command', value: routine.command, isMono: true, span: 'full' as const }]),
  ];
}

interface SkipsTableProps {
  skips: Skip[];
}

function SkipsTable({ skips }: SkipsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Skipped at</TableHead>
          <TableHead>Scheduled for</TableHead>
          <TableHead>Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...skips].reverse().map(skip => (
          <TableRow key={`${skip.at}-${skip.scheduledFor}`}>
            <TableCell>
              <RelativeTime iso={skip.at} isFocusable />
            </TableCell>
            <TableCell className="text-fg-secondary">
              <RelativeTime iso={skip.scheduledFor} isFocusable />
            </TableCell>
            <TableCell className="text-fg-secondary">{getSkipReasonLabel(skip.reason)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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
        <PageTitle>{name}</PageTitle>
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
      <Card className="gap-0 py-0">
        <DetailList entries={getStatEntries(routine)} />
      </Card>
      <Tabs defaultValue="runs" className="gap-4">
        <TabsList>
          <TabsTrigger value="runs">
            Runs
            <span className="text-fg-secondary tabular-nums">{routine.runs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="space-y-10">
          <Card className="gap-0 overflow-visible py-0">
            <RunsTable runs={routine.runs} hasRoutineColumn={false} />
          </Card>
          {routine.skips.length > 0 && (
            <section>
              <SectionTitle aside={<SectionAside>{routine.skips.length} skipped</SectionAside>}>
                Skipped runs
              </SectionTitle>
              <Card className="gap-0 overflow-visible py-0">
                <SkipsTable skips={routine.skips} />
              </Card>
            </section>
          )}
        </TabsContent>
        <TabsContent value="prompt">
          <Card className="gap-0 p-6">
            <Markdown source={routine.prompt} minHeadingLevel={2} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function RoutinePage() {
  const { name = '' } = useParams();
  useDocumentTitle(name);
  const { data, error, reload } = usePolledData(
    `routine/${name}`,
    () => getRoutine(name),
    getIsRoutineRunning,
  );

  return (
    <div>
      <Breadcrumbs
        crumbs={[{ label: 'Routines', to: '/' }]}
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
