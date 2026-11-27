import { Link } from 'react-router';
import { match } from 'ts-pattern';
import { RelativeTime, StatusDot, type StatusDotTone } from 'design-system';
import type { InboxGroup } from 'domains/inbox/types';
import { getInboxRunSummary } from 'domains/inbox/utils';
import type { RunRecord } from 'domains/run/types';
import { BlockedBadge, RunStatusBadge } from '@web-app/domains/run/components';
import { getRunPath } from '@web-app/paths';

interface RowAppearance {
  tone: StatusDotTone;
  hasStatusBadge: boolean;
}

function getRowAppearance(group: InboxGroup): RowAppearance {
  return match(group)
    .with('needs_look', (): RowAppearance => ({ tone: 'negative', hasStatusBadge: true }))
    .with('findings', (): RowAppearance => ({ tone: 'info', hasStatusBadge: false }))
    .with('quiet', (): RowAppearance => ({ tone: 'ghost', hasStatusBadge: false }))
    .exhaustive();
}

interface InboxRunRowProps {
  run: RunRecord;
  group: InboxGroup;
}

export function InboxRunRow({ run, group }: InboxRunRowProps) {
  const summary = getInboxRunSummary(run);
  const appearance = getRowAppearance(group);
  const blockedCount = run.blockedActions.length;
  return (
    <li>
      <Link
        to={getRunPath(run.routine, run.id)}
        className="flex gap-3 px-4 py-3 transition-colors hover:bg-hover focus-visible:bg-hover"
      >
        <span aria-hidden="true" className="flex h-lh shrink-0 items-center text-body">
          <StatusDot tone={appearance.tone} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-medium text-fg">{run.routine}</span>
            {appearance.hasStatusBadge && <RunStatusBadge status={run.status} />}
            {blockedCount > 0 && <BlockedBadge count={blockedCount} className="max-sm:hidden" />}
            <RelativeTime
              iso={run.endedAt ?? run.startedAt}
              className="ml-auto shrink-0 pl-2 text-body-sm text-fg-muted"
            />
          </span>
          {/* A phone has no room for a second badge beside the routine and its status. */}
          {(summary || blockedCount > 0) && (
            <span className="flex min-w-0 items-center gap-2">
              {blockedCount > 0 && <BlockedBadge count={blockedCount} className="sm:hidden" />}
              {summary && (
                <span className="truncate text-body-sm text-fg-secondary" title={summary}>
                  {summary}
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
