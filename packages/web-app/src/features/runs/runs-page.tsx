import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { RunsList } from '@web-app/components/runs-list';
import { NEW_RUN_PATH } from '@web-app/constants/path';
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
            {/* A 44px tap area on phones that keeps the header row as tall as the run count. */}
            <Button
              asChild
              size="small"
              className="relative max-sm:after:absolute max-sm:after:-inset-y-2 max-sm:after:inset-x-0"
            >
              <Link to={NEW_RUN_PATH}>
                <Plus aria-hidden="true" />
                New run
              </Link>
            </Button>
          </div>
        }
      />
      <RunsList runs={runs} hasRoutineColumn />
    </div>
  );
}
