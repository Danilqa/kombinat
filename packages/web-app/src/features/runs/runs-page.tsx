import { PageHeader } from 'design-system/layouts';
import { RunsList } from '@web-app/components/runs-list';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useRuns } from '@web-app/hooks/use-runs';

export function RunsPage() {
  useDocumentTitle('Runs');
  const runs = useRuns(null);

  return (
    <div>
      <PageHeader.Root
        title="Runs"
        aside={runs.data && <PageHeader.Aside>{runs.data.total} runs</PageHeader.Aside>}
      />
      <RunsList runs={runs} hasRoutineColumn />
    </div>
  );
}
