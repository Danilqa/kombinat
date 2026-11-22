import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { isMatching, match, P } from 'ts-pattern';

import { Button } from 'design-system/components';
import { cn, useLiveText, useLiveValue } from 'design-system/utils';
import { formatClockOrDayTime, formatRelative } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';

import { toPreview } from '../../transcript/utils';
import { QUERY_KEYS_CHANGED_BY_WAIT_ACTION, RETRY_DELAY_MINUTES } from '../constants';
import { sendWaitAction } from '../requests';
import type { RunRecord, RunRetry, UsageLimitWaitAction } from '../types';
import { checkIsWaitingForSlot, getAttemptLabel, getRunStatusLabel } from '../utils';

const SOON_MS = 10_000;

interface RetryActionsProps {
  run: RunRecord;
  retry: RunRetry;
}

function RetryActions({ run, retry }: RetryActionsProps) {
  const queryClient = useQueryClient();
  // The runner takes the action within a second, and the run leaves this state once it has.
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
  const isBusy = isPending || requested !== null;
  const isRetrying = isMatching('continue', requested);
  const isStopping = isMatching('stop', requested);

  function act(action: UsageLimitWaitAction) {
    if (!isBusy) mutate(action);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:pl-6">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            className="max-sm:h-9"
            aria-disabled={isBusy || undefined}
            onClick={() => act('continue')}
          >
            {isRetrying && <Loader aria-hidden="true" className="spin-in-place size-3.5" />}
            {isRetrying ? 'Retrying…' : 'Retry now'}
          </Button>
          <Button
            variant="tertiary"
            size="small"
            className="max-sm:h-9"
            aria-disabled={isBusy || undefined}
            onClick={() => act('stop')}
          >
            {isStopping && <Loader aria-hidden="true" className="spin-in-place size-3.5" />}
            {isStopping ? 'Stopping…' : 'Stop retrying'}
          </Button>
        </div>
        <p className="text-caption text-fg-muted">
          <code className="font-mono text-fg-secondary">retries: {retry.attempts - 1}</code> in the
          routine, {RETRY_DELAY_MINUTES} min apart
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
    </>
  );
}

interface RetryWaitTextProps {
  retry: RunRetry;
}

function RetryWaitText({ retry }: RetryWaitTextProps) {
  const countdown = useLiveText(now =>
    new Date(retry.continuesAt).getTime() - now > SOON_MS
      ? `, ${formatRelative(retry.continuesAt, now)}`
      : '',
  );
  const isWaitingForSlot = useLiveValue(now => checkIsWaitingForSlot(retry, now));
  if (isWaitingForSlot) {
    return ' All run slots are taken. Kombinat retries as soon as another run finishes.';
  }
  return (
    <>
      {retry.continuesSession
        ? ' Kombinat continues its session right where it left off at '
        : ' Kombinat starts it over at '}
      <time dateTime={retry.continuesAt} className="font-medium text-fg tabular-nums">
        {formatClockOrDayTime(retry.continuesAt)}
      </time>
      {/* A short relative time such as "in 4 min." ends with its own period. */}
      {countdown.endsWith('.') ? countdown : `${countdown}.`}
    </>
  );
}

function getTitle(run: RunRecord, retry: RunRetry): string {
  return match(run.status)
    .with(
      'retrying',
      () => `Attempt ${retry.attempt - 1} of ${retry.attempts} stopped with an error`,
    )
    .with(P.union('running', 'waiting'), () => `${getAttemptLabel(retry)} is running`)
    .otherwise(
      status => `${getRunStatusLabel(status)} on attempt ${retry.attempt} of ${retry.attempts}`,
    );
}

interface RetryCardProps {
  run: RunRecord;
  retry: RunRetry;
}

export function RetryCard({ run, retry }: RetryCardProps) {
  const titleId = useId();
  const isRetrying = isMatching('retrying', run.status);
  const error = toPreview(retry.error);
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'mb-6 rounded-xl border bg-surface p-4 sm:p-5',
        isRetrying ? 'border-info/30' : 'border-line',
      )}
    >
      <h2 id={titleId} className="flex items-start gap-2 text-body font-medium text-fg">
        <RotateCcw aria-hidden="true" className="h-lh w-4 shrink-0 text-info" />
        {getTitle(run, retry)}
      </h2>
      <p className="mt-1 text-body-sm text-fg-muted wrap-anywhere sm:pl-6">
        Attempt {retry.attempt - 1} stopped at{' '}
        <time dateTime={retry.stoppedAt} className="text-fg-secondary tabular-nums">
          {formatClockOrDayTime(retry.stoppedAt)}
        </time>
        : <span className="font-mono text-fg-secondary">{error}</span>
        {/[.!?…]$/.test(error) ? '' : '.'}
        {isRetrying ? (
          <RetryWaitText retry={retry} />
        ) : retry.continuesSession ? (
          ` Attempt ${retry.attempt} continued the same session, right where it left off.`
        ) : (
          ` Attempt ${retry.attempt} started over.`
        )}
      </p>
      {isRetrying && <RetryActions run={run} retry={retry} />}
    </section>
  );
}
