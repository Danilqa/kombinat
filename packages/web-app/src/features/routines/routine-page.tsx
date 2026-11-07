import { useParams } from 'react-router';
import { Card } from 'design-system/components/card';
import { Markdown } from 'design-system/components/markdown';
import { ErrorState, LoadingState } from 'design-system/components/page-states';
import { RelativeTime } from 'design-system/components/relative-time';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'design-system/components/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'design-system/components/tabs';
import { PageTitle, SectionAside, SectionTitle } from 'design-system/layouts/page-header';
import { RoutineBadges, RoutineDetailList, RunNowButton } from 'domains/routine/components';
import { getRoutine } from 'domains/routine/requests';
import type { RoutineDetail } from 'domains/routine/types';
import type { Skip } from 'domains/scheduler/types';
import { getSkipReasonLabel } from 'domains/scheduler/utils';
import { usePolledData } from 'utils/hooks/use-polled-data';
import { sameOriginApi } from 'utils/http';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { RunsTable } from '@web-app/components/runs-table';
import { ROUTINES_PATH } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

function getIsRoutineRunning(routine: RoutineDetail): boolean {
  return routine.running;
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
        <RoutineDetailList routine={routine} />
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
    () => getRoutine(sameOriginApi, name),
    getIsRoutineRunning,
  );

  return (
    <div>
      <Breadcrumbs
        crumbs={[{ label: 'Routines', to: ROUTINES_PATH }]}
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
