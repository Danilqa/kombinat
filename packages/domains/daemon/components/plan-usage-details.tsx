import { Fragment } from 'react';

import { cn } from 'design-system/utils';

import type { AccountLimits, DaemonStatus } from '../types';
import {
  checkHasSeveralAccounts,
  checkIsUsageLow,
  formatUsageLeft,
  getAccountLimits,
  getLeftRatio,
} from '../utils';
import { LiveRelativeTime } from './live-relative-time';

interface AccountLimitListProps {
  account: AccountLimits;
}

function AccountLimitList({ account }: AccountLimitListProps) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
      {account.limits.map(limit => {
        const isLow = checkIsUsageLow(limit);
        return (
          <Fragment key={limit.label}>
            <dt className="text-fg-muted">{limit.label}</dt>
            <dd className="tabular-nums">
              <span className={cn(isLow && 'text-warning')}>{formatUsageLeft(limit)} left</span>
              <span className="text-fg-muted">
                {' '}
                · resets <LiveRelativeTime iso={limit.resetsAt} />
              </span>
              <span aria-hidden="true" className="mt-1 mb-1.5 block h-1 rounded-full bg-overlay">
                <span
                  className={cn(
                    'block h-full rounded-full',
                    isLow ? 'bg-warning' : 'bg-fg-secondary',
                  )}
                  style={{ width: `${getLeftRatio(limit) * 100}%` }}
                />
              </span>
            </dd>
          </Fragment>
        );
      })}
      <dt className="text-fg-muted">Updated</dt>
      <dd className="tabular-nums">
        <LiveRelativeTime iso={account.updatedAt} />
      </dd>
    </dl>
  );
}

interface PlanUsageDetailsProps {
  status: DaemonStatus;
  className?: string;
}

export function PlanUsageDetails({ status, className }: PlanUsageDetailsProps) {
  const accounts = getAccountLimits(status);
  if (accounts.length === 0) return null;
  const hasSeveralAccounts = checkHasSeveralAccounts(status);
  return (
    <div className={cn('space-y-3', className)}>
      {accounts.map(account => (
        <div key={account.label}>
          <p className="mb-1.5 font-medium">
            {hasSeveralAccounts ? (
              <>
                <span className="break-all">{account.label}</span>
                <span className="font-normal text-fg-muted">
                  {' '}
                  · {account.routines} {account.routines === 1 ? 'routine' : 'routines'}
                </span>
              </>
            ) : (
              'Claude plan'
            )}
          </p>
          <AccountLimitList account={account} />
        </div>
      ))}
      <p className="text-fg-muted">
        To run a routine on another account, add{' '}
        <code className="font-mono whitespace-nowrap">account: &lt;name&gt;</code> to it and run{' '}
        <code className="font-mono whitespace-nowrap">kombinat login &lt;name&gt;</code>.
      </p>
    </div>
  );
}
