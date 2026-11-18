import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { RelativeTime } from 'design-system/components';
import { cn } from 'design-system/utils';
import type { InboxGroup } from 'domains/inbox/types';
import { getInboxRunSummary } from 'domains/inbox/utils';
import { RunStatusBadge } from 'domains/run/components';
import type { RunRecord } from 'domains/run/types';
import { getRunPath } from '@web-app/constants/path';

interface RowAppearance {
  dotClassName: string;
  hasStatusBadge: boolean;
}

function getRowAppearance(group: InboxGroup): RowAppearance {
  return match(group)
    .with('needs_look', () => ({ dotClassName: 'bg-negative', hasStatusBadge: true }))
    .with('findings', () => ({ dotClassName: 'bg-info', hasStatusBadge: false }))
    .with('quiet', () => ({ dotClassName: 'bg-fg-faint', hasStatusBadge: false }))
    .exhaustive();
}

interface InboxRunRowProps {
  run: RunRecord;
  group: InboxGroup;
}

export function InboxRunRow({ run, group }: InboxRunRowProps) {
  const summary = getInboxRunSummary(run);
  const appearance = getRowAppearance(group);
  return (
    <li>
      <Link
        to={getRunPath(run.routine, run.id)}
        className="flex gap-3 px-4 py-3 transition-colors hover:bg-hover focus-visible:bg-hover"
      >
        <span aria-hidden="true" className="flex h-lh shrink-0 items-center text-body">
          <span className={cn('size-1.5 rounded-full', appearance.dotClassName)} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-medium text-fg">{run.routine}</span>
            {appearance.hasStatusBadge && <RunStatusBadge status={run.status} />}
            <RelativeTime
              iso={run.endedAt ?? run.startedAt}
              className="ml-auto shrink-0 pl-2 text-body-sm text-fg-muted"
            />
          </span>
          {summary && (
            <span className="truncate text-body-sm text-fg-secondary" title={summary}>
              {summary}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
