import { useParams } from 'react-router';
import { match } from 'ts-pattern';
import { Breadcrumbs, PageTitle, SectionTitle } from '@/components/page-header';
import { DetailList } from '@/components/detail-list';
import { Markdown } from '@/components/markdown';
import { ErrorState, LoadingState } from '@/components/page-states';
import { RelativeTime } from '@/components/relative-time';
import { RunNowButton } from '@/components/run-now-button';
import { RunsTable } from '@/components/runs-table';
import { getSkipReasonLabel } from '@/components/status-badge';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getRoutine, type RoutineDetail, type Skip } from '@/lib/api';
import { usePolledData } from '@/lib/use-polled-data';
import { cn } from '@/lib/utils';

function getIsRoutineRunning(routine: RoutineDetail): boolean {
  return routine.running;
}

type EnabledState = 'enabled' | 'disabled';

const enabledBadges: Record<EnabledState, { variant: BadgeVariant; dotClassName: string }> = {
  enabled: { variant: 'positive', dotClassName: 'bg-dark-green' },
  disabled: { variant: 'ghost', dotClassName: 'bg-grey-40' },
};

function getEnabledState(routine: RoutineDetail): EnabledState {
  return match(routine.enabled)
    .with(true, () => 'enabled' as const)
    .with(false, () => 'disabled' as const)
    .exhaustive();
}

function RoutineBadges({ routine }: { routine: RoutineDetail }) {
  const enabledState = getEnabledState(routine);
  const enabledBadge = enabledBadges[enabledState];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge size="small">{routine.scheduleHuman}</Badge>
      {routine.schedule && (
        <Badge size="small" className="font-mono normal-case">
          {routine.schedule}
        </Badge>
      )}
      <Badge size="small">{routine.agent}</Badge>
      {routine.model !== null && (
        <Badge size="small" className="font-mono normal-case">
          {routine.model}
        </Badge>
      )}
      {routine.effort !== null && <Badge size="small">effort {routine.effort}</Badge>}
      {routine.permissionMode !== null && (
        <Badge size="small">permission {routine.permissionMode}</Badge>
      )}
      <Badge size="small" variant={enabledBadge.variant}>
        <span className={cn('size-2 rounded-full', enabledBadge.dotClassName)} />
        {enabledState}
      </Badge>
    </div>
  );
}

function SkipsTable({ skips }: { skips: Skip[] }) {
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
              <RelativeTime iso={skip.at} />
            </TableCell>
            <TableCell>
              <RelativeTime iso={skip.scheduledFor} />
            </TableCell>
            <TableCell>{getSkipReasonLabel(skip.reason)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RoutineView({ routine, onStarted }: { routine: RoutineDetail; onStarted: () => void }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <PageTitle>{routine.name}</PageTitle>
          <p className="text-paragraph-14 text-grey-70">{routine.description}</p>
          <RoutineBadges routine={routine} />
        </div>
        <RunNowButton routine={routine.name} isRunning={routine.running} onStarted={onStarted} />
      </header>
      <div>
        <DetailList
          entries={[
            { label: 'cwd', value: routine.cwd, isMono: true },
            ...(routine.command === null
              ? []
              : [{ label: 'command', value: routine.command, isMono: true }]),
            { label: 'file', value: routine.file, isMono: true },
            { label: 'next run', value: <RelativeTime iso={routine.nextRunAt} /> },
            { label: 'timeout', value: `${routine.timeoutMinutes} min` },
            {
              label: 'budget',
              value: routine.maxBudgetUsd === null ? 'none' : `$${routine.maxBudgetUsd.toFixed(2)}`,
            },
          ]}
        />
      </div>
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs ({routine.runs.length})</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="space-y-8 pt-4">
          <Card className="gap-0 py-0">
            <RunsTable runs={routine.runs} hasRoutineColumn={false} />
          </Card>
          {routine.skips.length > 0 && (
            <section>
              <SectionTitle>Skipped runs</SectionTitle>
              <Card className="gap-0 py-0">
                <SkipsTable skips={routine.skips} />
              </Card>
            </section>
          )}
        </TabsContent>
        <TabsContent value="prompt" className="pt-4">
          <Card className="py-6">
            <CardContent className="px-6">
              <Markdown source={routine.prompt} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function RoutinePage() {
  const { name = '' } = useParams();
  const { data, error, reload } = usePolledData(
    `routine/${name}`,
    () => getRoutine(name),
    getIsRoutineRunning,
  );

  return (
    <div>
      <Breadcrumbs crumbs={[{ label: name }]} />
      {error && <ErrorState message={error} />}
      {!data && !error && <LoadingState />}
      {data && <RoutineView routine={data} onStarted={reload} />}
    </div>
  );
}
