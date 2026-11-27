import { Gauge } from 'lucide-react';

import { Popover, cn } from 'design-system';
import type { CurrentUsageLimit } from 'domains/daemon/types';
import {
  checkHasSeveralAccounts,
  checkIsUsageLow,
  formatUsageLeft,
  getAccountLimits,
  getMostUsedLimit,
} from 'domains/daemon/utils';
import { PlanUsageDetails } from '../plan-usage-details';
import { useDaemonStatus } from '../queries';

interface ShownAccount {
  label: string;
  limit: CurrentUsageLimit;
  isLow: boolean;
}

interface AccountLeftProps {
  account: ShownAccount;
  hasName: boolean;
}

function AccountLeft({ account, hasName }: AccountLeftProps) {
  return (
    <>
      {hasName ? (
        <span className="inline-block max-w-24 truncate align-bottom lg:max-xl:max-w-14">
          {account.label}
        </span>
      ) : (
        'Claude'
      )}{' '}
      <span className={cn(account.isLow ? 'text-warning' : 'text-fg-secondary')}>
        {formatUsageLeft(account.limit)}
      </span>
    </>
  );
}

interface MoreAccountsProps {
  count: number;
}

function MoreAccounts({ count }: MoreAccountsProps) {
  if (count === 0) return null;
  return (
    <span className="lg:max-xl:hidden">
      {' '}
      · +{count}
      <span className="sr-only"> more {count === 1 ? 'account' : 'accounts'}</span>
    </span>
  );
}

// Reads the status that DaemonStatusIndicator polls. Below md it hides, and the plan shows in the
// popover of DaemonStatusIndicator instead.
export function PlanUsageIndicator() {
  const { data } = useDaemonStatus();
  const accounts = (data ? getAccountLimits(data) : []).flatMap(
    ({ label, limits }): ShownAccount[] => {
      const limit = getMostUsedLimit(limits);
      return limit === undefined ? [] : [{ label, limit, isLow: checkIsUsageLow(limit) }];
    },
  );
  // The least left first. The header has room for two, and while the nav shares its row, for one
  // without a count of the rest. The popover lists them all.
  const [first, second, ...rest] = accounts.toSorted(
    (a, b) => b.limit.usedRatio - a.limit.usedRatio,
  );
  if (data === undefined || first === undefined) return null;
  const hasSeveralAccounts = checkHasSeveralAccounts(data);
  const isEveryLow = accounts.every(({ isLow }) => isLow);
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          'flex h-8 animate-in items-center gap-1.5 rounded-full px-2.5 text-body-sm text-fg-muted tabular-nums transition-colors animation-duration-300 fade-in hover:bg-hover hover:text-fg data-[state=open]:bg-overlay max-md:hidden',
          isEveryLow && 'text-warning',
        )}
      >
        <Gauge aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="whitespace-nowrap">
          <AccountLeft account={first} hasName={hasSeveralAccounts} />
          {second && (
            <span className="lg:max-xl:hidden">
              {' · '}
              <AccountLeft account={second} hasName />
            </span>
          )}{' '}
          left
          <MoreAccounts count={rest.length} />
          <span className="sr-only">, plan usage</span>
        </span>
      </Popover.Trigger>
      {/* Several accounts can be taller than a phone, so the popover scrolls. */}
      <Popover.Content
        side="bottom"
        align="end"
        className="max-h-(--radix-popover-content-available-height) overflow-y-auto"
      >
        <PlanUsageDetails status={data} />
      </Popover.Content>
    </Popover.Root>
  );
}
