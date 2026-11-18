import { CheckCheck } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { groupInboxRuns, toInboxRunKey } from 'domains/inbox/utils';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { useInbox } from '@web-app/hooks/use-inbox';
import { useMarkRunsRead } from '@web-app/hooks/use-mark-runs-read';
import { InboxSection } from './inbox-section';

export function InboxPage() {
  useDocumentTitle('Inbox');
  const { data, error, isPending } = useInbox();
  const markRead = useMarkRunsRead();
  const runs = data?.runs ?? [];

  return (
    <div>
      <PageHeader.Root
        title="Inbox"
        aside={
          runs.length > 0 && (
            <div className="flex items-center gap-3">
              <PageHeader.Aside>{runs.length} unread</PageHeader.Aside>
              {/* Only the runs on screen, so a run that ends meanwhile stays unread. */}
              <Button
                variant="secondary"
                size="small"
                className="relative max-sm:after:absolute max-sm:after:-inset-2"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(runs.map(toInboxRunKey))}
              >
                <CheckCheck aria-hidden="true" />
                Mark all as read
              </Button>
            </div>
          )
        }
      />
      {error && <ErrorState message={error.message} />}
      {markRead.error && <ErrorState message={markRead.error.message} />}
      {isPending && <LoadingState />}
      {data &&
        (runs.length === 0 ? (
          <Card.Root className="py-0">
            <EmptyState>You are all caught up. New runs show up here when they finish.</EmptyState>
          </Card.Root>
        ) : (
          <div className="space-y-8">
            {groupInboxRuns(runs).map(section => (
              <InboxSection key={section.group} section={section} />
            ))}
          </div>
        ))}
    </div>
  );
}
