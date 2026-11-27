import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { Button, PageHeader } from 'design-system';
import { useRuns } from '@web-app/domains/run/queries';
import { RunsList } from '@web-app/domains/run/runs-list';
import { RunRetentionMenu } from '@web-app/domains/settings/run-retention-menu';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { NEW_RUN_PATH } from '@web-app/paths';

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
            <RunRetentionMenu />
            <Button asChild size="small" className="tap-area max-sm:after:inset-x-0">
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
