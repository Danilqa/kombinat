import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader, Play } from 'lucide-react';

import { Button, DropdownMenu, Popover, Tooltip } from 'design-system/components';
import { cn } from 'design-system/utils';
import { formatDayTime } from 'utils/date-time';
import { sameOriginApi } from 'utils/http';

import { QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS, QUERY_KEYS_CHANGED_BY_RUN } from '../constants';
import type { RoutineName } from '../ids';
import { scheduleOneTimeRun, startRoutineRun } from '../requests';
import { RunLaterForm } from './run-later-form';
import { RunLaterMenuItems } from './run-later-menu-items';

const SCHEDULED_NOTE_MS = 4000;

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
  ref?: Ref<HTMLButtonElement>;
}

export function RunNowButton({
  routine,
  isRunning,
  variant = 'primary',
  menu,
  ref,
}: RunNowButtonProps) {
  const queryClient = useQueryClient();
  const [isPickingTime, setIsPickingTime] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const isPickerRequested = useRef(false);
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
  const scheduledTime = scheduleRun.isSuccess
    ? formatDayTime(scheduleRun.variables.toISOString())
    : null;
  const { isSuccess: isScheduled, reset: resetScheduleRun } = scheduleRun;

  useEffect(() => {
    if (!isScheduled) return;
    const timeout = setTimeout(resetScheduleRun, SCHEDULED_NOTE_MS);
    return () => clearTimeout(timeout);
  }, [isScheduled, resetScheduleRun]);

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
        {scheduledTime !== null && `${routine} runs once at ${scheduledTime}`}
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
              ref={ref}
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
              <Tooltip.Root
                open={scheduledTime !== null}
                onOpenChange={isOpen => {
                  if (!isOpen) resetScheduleRun();
                }}
              >
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Tooltip.Trigger asChild>
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
                    </Tooltip.Trigger>
                  </DropdownMenu.Trigger>
                  {/* Portaled clicks still bubble to the row link. */}
                  <DropdownMenu.Content
                    onClick={event => event.stopPropagation()}
                    // Opened any sooner, the picker loses the focus to the closing menu's focus trap.
                    onCloseAutoFocus={event => {
                      if (!isPickerRequested.current) return;
                      isPickerRequested.current = false;
                      event.preventDefault();
                      togglePicker(true);
                    }}
                  >
                    {menu}
                    <DropdownMenu.Separator />
                    <RunLaterMenuItems
                      onSchedule={runLater}
                      onPickTime={() => {
                        isPickerRequested.current = true;
                      }}
                    />
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
                <Tooltip.Content collisionPadding={8} onClick={event => event.stopPropagation()}>
                  Runs once at {scheduledTime}
                </Tooltip.Content>
              </Tooltip.Root>
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
