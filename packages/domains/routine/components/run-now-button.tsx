import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader, Play } from 'lucide-react';

import { Button, DropdownMenu, Popover } from 'design-system/components';
import { cn } from 'design-system/utils';
import { formatDayTime } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';

import { QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS, QUERY_KEYS_CHANGED_BY_RUN } from '../constants';
import type { RoutineName } from '../ids';
import { scheduleOneTimeRun, startRoutineRun } from '../requests';
import { RunLaterForm } from './run-later-form';
import { RunLaterMenuItems } from './run-later-menu-items';

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
  const [isPickingTime, setIsPickingTime] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const invalidate = (queryKeys: string[][]) =>
    Promise.all(queryKeys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  const startRun = useMutation({
    mutationFn: () => startRoutineRun(sameOriginApi, routine),
    onSuccess: () => invalidate(QUERY_KEYS_CHANGED_BY_RUN),
  });
  const scheduleRun = useMutation({
    mutationFn: (at: Date) => scheduleOneTimeRun(sameOriginApi, routine, at.toISOString()),
    onSuccess: () => {
      setIsPickingTime(false);
      return invalidate(QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS);
    },
  });
  // aria-disabled instead of disabled keeps keyboard focus on the button after it is pressed.
  const isUnavailable = isRunning || startRun.isPending;
  const error = startRun.error ?? (isPickingTime ? null : scheduleRun.error);

  function runNow() {
    if (isUnavailable) return;
    scheduleRun.reset();
    startRun.mutate();
  }

  function runLater(at: Date) {
    startRun.reset();
    scheduleRun.mutate(at);
  }

  function togglePicker(isOpen: boolean) {
    startRun.reset();
    scheduleRun.reset();
    setIsPickingTime(isOpen);
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <span role="status" className="sr-only">
        {startRun.isSuccess && `Started a run of ${routine}`}
        {scheduleRun.isSuccess &&
          `Scheduled a run of ${routine} for ${formatDayTime(scheduleRun.variables.toISOString())}`}
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
      <Popover.Root open={isPickingTime} onOpenChange={togglePicker}>
        <Popover.Anchor asChild>
          <div className="flex">
            <Button
              variant={variant}
              size="small"
              aria-disabled={isUnavailable || undefined}
              className={cn(menu && 'rounded-r-none pr-2.5 interactive:active:scale-100')}
              onClick={runNow}
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
                    ref={menuTriggerRef}
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
                {/* Portaled clicks still bubble to the row link. */}
                <DropdownMenu.Content
                  onClick={event => event.stopPropagation()}
                  // The time picker takes the focus, so the closing menu must not return it.
                  onCloseAutoFocus={event => {
                    if (isPickingTime) event.preventDefault();
                  }}
                >
                  {menu}
                  <DropdownMenu.Separator />
                  <RunLaterMenuItems onSchedule={runLater} onPickTime={() => togglePicker(true)} />
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            )}
          </div>
        </Popover.Anchor>
        <Popover.Content
          align="end"
          aria-label={`Run ${routine} once later`}
          onClick={event => event.stopPropagation()}
          // It opens from the menu, which has no trigger of its own to return the focus to.
          onCloseAutoFocus={event => {
            event.preventDefault();
            menuTriggerRef.current?.focus();
          }}
        >
          <RunLaterForm
            routine={routine}
            isPending={scheduleRun.isPending}
            error={scheduleRun.error?.message ?? null}
            onSubmit={runLater}
            onCancel={() => togglePicker(false)}
          />
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
