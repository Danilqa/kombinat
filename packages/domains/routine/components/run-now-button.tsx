import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';

import { Button } from 'design-system/components';
import { sameOriginApi } from 'utils/http';

import type { RoutineId } from '../../id/types';
import { startRoutineRun } from '../requests';

const QUERY_KEYS_CHANGED_BY_RUN = [['routines'], ['runs'], ['calendar'], ['status']];

type RunNowVariant = 'primary' | 'secondary';

interface RunNowButtonProps {
  routine: RoutineId;
  isRunning: boolean;
  variant?: RunNowVariant;
}

export function RunNowButton({ routine, isRunning, variant = 'primary' }: RunNowButtonProps) {
  const queryClient = useQueryClient();
  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: () => startRoutineRun(sameOriginApi, routine),
    onSuccess: () =>
      Promise.all(
        QUERY_KEYS_CHANGED_BY_RUN.map(queryKey => queryClient.invalidateQueries({ queryKey })),
      ),
  });
  // aria-disabled instead of disabled keeps keyboard focus on the button after it is pressed.
  const isUnavailable = isRunning || isPending;

  function startRun() {
    if (!isUnavailable) mutate();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span role="status" className="sr-only">
        {isSuccess && `Started a run of ${routine}`}
      </span>
      {error && (
        <span
          role="alert"
          className="max-w-56 truncate text-body-sm text-negative"
          title={error.message}
        >
          {error.message}
        </span>
      )}
      <Button
        variant={variant}
        size="small"
        aria-disabled={isUnavailable || undefined}
        onClick={startRun}
      >
        <Play aria-hidden="true" className="size-3.5 fill-current" />
        {isRunning ? 'Running' : 'Run now'}
        <span className="sr-only"> {routine}</span>
      </Button>
    </div>
  );
}
