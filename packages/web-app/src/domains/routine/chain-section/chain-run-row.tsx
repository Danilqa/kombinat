import { Link } from 'react-router';
import { RelativeTime } from 'design-system';
import { getInboxRunSummary } from 'domains/inbox/utils';
import type { ChainLink } from 'domains/routine/types';
import { RunStatusBadge } from '@web-app/domains/run/components';
import { getRunPath } from '@web-app/paths';

interface ChainRunRowProps {
  link: ChainLink;
}

export function ChainRunRow({ link }: ChainRunRowProps) {
  const run = link.lastRun;
  if (run === null) {
    return (
      <li className="flex min-w-0 items-center gap-2 px-4 py-3">
        <span className="truncate text-body font-medium text-fg">{link.name}</span>
        <span className="ml-auto shrink-0 pl-2 text-body-sm text-fg-muted">No runs yet</span>
      </li>
    );
  }
  const summary = getInboxRunSummary(run);
  return (
    <li>
      <Link
        to={getRunPath(run.routine, run.id)}
        className="flex min-w-0 flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-hover focus-visible:bg-hover"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-medium text-fg">{link.name}</span>
          <RunStatusBadge status={run.status} />
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
      </Link>
    </li>
  );
}
