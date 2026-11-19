import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hourglass, Loader } from 'lucide-react';
import { useId, useState } from 'react';
import { isMatching } from 'ts-pattern';

import { Button } from 'design-system/components';
import { useLiveText, useLiveValue } from 'design-system/utils';
import { formatClockOrDayTime, formatRelative } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';

import { getAgentLabel } from '../../agent/utils';
import { getUsageLimitLabel } from '../../transcript/utils';
import { QUERY_KEYS_CHANGED_BY_WAIT_ACTION } from '../constants';
import { sendWaitAction } from '../requests';
import type { RunRecord, UsageLimitWait, UsageLimitWaitAction } from '../types';
import { checkIsWaitingForSlot } from '../utils';

const SOON_MS = 10_000;

interface UsageLimitCardProps {
  run: RunRecord;
  wait: UsageLimitWait;
}

export function UsageLimitCard({ run, wait }: UsageLimitCardProps) {
  const titleId = useId();
  const queryClient = useQueryClient();
  // The runner takes the action within a second, and this card goes away once it has.
  const [requested, setRequested] = useState<UsageLimitWaitAction | null>(null);
  const { mutate, isPending, error } = useMutation({
    mutationFn: (action: UsageLimitWaitAction) =>
      sendWaitAction(sameOriginApi, run.routine, run.id, action),
    onSuccess: (_, action) => {
      setRequested(action);
      return Promise.all(
        QUERY_KEYS_CHANGED_BY_WAIT_ACTION.map(queryKey =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
  const countdown = useLiveText(now =>
    new Date(wait.continuesAt).getTime() - now > SOON_MS
      ? `, ${formatRelative(wait.continuesAt, now)}`
      : '',
  );
  const isWaitingForSlot = useLiveValue(now => checkIsWaitingForSlot(wait, now));
  const isBusy = isPending || requested !== null;
  const isContinuing = isMatching('continue', requested);
  const isStopping = isMatching('stop', requested);

  function act(action: UsageLimitWaitAction) {
    if (!isBusy) mutate(action);
  }

  return (
    <section
      aria-labelledby={titleId}
      className="mb-6 rounded-xl border border-info/30 bg-surface p-4 sm:p-5"
    >
      <h2 id={titleId} className="flex items-start gap-2 text-body font-medium text-fg">
        <Hourglass aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
        {isWaitingForSlot ? (
          'Waiting for a free run slot'
        ) : (
          <>
            Waiting for {getAgentLabel(run.agent)}&rsquo;s {getUsageLimitLabel(wait.limit)} to reset
          </>
        )}
      </h2>
      <p className="mt-1 text-body-sm text-fg-muted sm:pl-6">
        The agent stopped at{' '}
        <time dateTime={wait.stoppedAt} className="text-fg-secondary tabular-nums">
          {formatClockOrDayTime(wait.stoppedAt)}
        </time>
        {isWaitingForSlot ? (
          <>
            {' '}
            and the {getUsageLimitLabel(wait.limit)} has reset. All run slots are taken, so Kombinat
            continues its session as soon as another run finishes.
          </>
        ) : (
          <>
            . Kombinat continues its session at{' '}
            <time dateTime={wait.continuesAt} className="font-medium text-fg tabular-nums">
              {formatClockOrDayTime(wait.continuesAt)}
            </time>
            {countdown}, right where it left off.
          </>
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:pl-6">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            className="max-sm:h-9"
            aria-disabled={isBusy || undefined}
            onClick={() => act('continue')}
          >
            {isContinuing && <Loader aria-hidden="true" className="spin-in-place size-3.5" />}
            {isContinuing ? 'Continuing…' : 'Continue now'}
          </Button>
          <Button
            variant="tertiary"
            size="small"
            className="max-sm:h-9"
            aria-disabled={isBusy || undefined}
            onClick={() => act('stop')}
          >
            {isStopping && <Loader aria-hidden="true" className="spin-in-place size-3.5" />}
            {isStopping ? 'Stopping…' : 'Stop waiting'}
          </Button>
        </div>
        <p className="text-caption text-fg-muted">
          <code className="font-mono text-fg-secondary">onUsageLimit: fail</code> in the routine
          fails the run instead
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 animate-in text-body-sm text-negative duration-200 fade-in sm:pl-6"
        >
          {error.message}
        </p>
      )}
    </section>
  );
}
