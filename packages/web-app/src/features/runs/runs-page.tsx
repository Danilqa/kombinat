import { PageHeader } from 'design-system/layouts';
import { RunsList } from '@web-app/components/runs-list';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useRuns } from '@web-app/hooks/use-runs';
import { RunsSettingsMenu } from './runs-settings-menu';

export function RunsPage() {
  useDocumentTitle('Runs');
  const runs = useRuns(null);

  return (
    <div>
      <PageHeader.Root
        title="Runs"
        aside={
          <div className="flex items-center gap-2">
            {runs.data && (
              <PageHeader.Aside>
                {runs.data.total} {runs.data.total === 1 ? 'run' : 'runs'}
              </PageHeader.Aside>
            )}
            <RunsSettingsMenu />
          </div>
        }
      />
      <RunsList runs={runs} hasRoutineColumn />
    </div>
  );
}
