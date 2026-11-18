import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader, Play } from 'lucide-react';

import { Button, DropdownMenu } from 'design-system/components';
import { cn } from 'design-system/utils';
import { sameOriginApi } from 'utils/http';

import { QUERY_KEYS_CHANGED_BY_RUN } from '../constants';
import type { RoutineName } from '../ids';
import { startRoutineRun } from '../requests';

type RunNowVariant = 'primary' | 'secondary';

const MENU_TRIGGER_CLASS_NAMES: Record<RunNowVariant, string> = {
  primary: 'border-l border-page/25',
  secondary: '-ml-px',
};

interface RunNowButtonProps {
  routine: RoutineName;
  isRunning: boolean;
  variant?: RunNowVariant;
  menu?: ReactNode;
}

export function RunNowButton({ routine, isRunning, variant = 'primary', menu }: RunNowButtonProps) {
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
    <div className="flex min-w-0 items-center justify-end gap-2">
      <span role="status" className="sr-only">
        {isSuccess && `Started a run of ${routine}`}
      </span>
      {error && (
        <span
          role="alert"
          className="max-w-56 animate-in truncate text-body-sm text-negative duration-200 fade-in slide-in-from-right-1"
          title={error.message}
        >
          {error.message}
        </span>
      )}
      <div className="flex">
        <Button
          variant={variant}
          size="small"
          aria-disabled={isUnavailable || undefined}
          className={cn(menu && 'rounded-r-none pr-2.5 interactive:active:scale-100')}
          onClick={startRun}
        >
          {isUnavailable ? (
            <Loader aria-hidden="true" className="spin-in-place size-3.5" />
          ) : (
            <Play
              aria-hidden="true"
              className="size-3.5 fill-current transition-transform duration-200 ease-out-quint group-hover/button:translate-x-0.5"
            />
          )}
          {isRunning ? 'Running' : 'Run now'}
          <span className="sr-only"> {routine}</span>
        </Button>
        {menu && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant={variant}
                size="small"
                aria-label={`More ways to run ${routine}`}
                className={cn(
                  'rounded-l-none pr-2 pl-1.5 interactive:active:scale-100',
                  MENU_TRIGGER_CLASS_NAMES[variant],
                )}
              >
                <ChevronDown
                  aria-hidden="true"
                  className="transition-transform duration-200 ease-out-quint group-data-[state=open]/button:rotate-180"
                />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>{menu}</DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>
    </div>
  );
}
