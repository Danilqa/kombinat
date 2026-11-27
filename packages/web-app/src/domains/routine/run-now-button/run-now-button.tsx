import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { ChevronDown, Loader, Play, Repeat } from 'lucide-react';
import { match } from 'ts-pattern';

import { Button, DropdownMenu, Popover, Tooltip, cn } from 'design-system';
import type { RoutineName } from 'domains/routine/ids';
import type { StartRunRequest } from 'domains/routine/types';
import { formatDayTime } from 'utils/date-time';
import { useScheduleOneTimeRun, useStartRoutineRun } from '../queries';
import { RunLaterForm } from './run-later-form';
import { RunLaterMenuItems } from './run-later-menu-items';
import { RunSeveralForm } from './run-several-form';

const SCHEDULED_NOTE_MS = 4000;

type RunNowVariant = 'primary' | 'secondary';

type RunNowForm = 'later' | 'several';

const MENU_TRIGGER_CLASS_NAMES: Record<RunNowVariant, string> = {
  primary: 'border-l border-page/25',
  secondary: '-ml-px',
};

interface RunNowButtonProps {
  routine: RoutineName;
  runs: number;
  isRunning: boolean;
  variant?: RunNowVariant;
  menu?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function RunNowButton({
  routine,
  runs,
  isRunning,
  variant = 'primary',
  menu,
  ref,
}: RunNowButtonProps) {
  const [openForm, setOpenForm] = useState<RunNowForm | null>(null);
  // Kept while the popover closes, so its content does not change under the fade.
  const [shownForm, setShownForm] = useState<RunNowForm>('later');
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const requestedForm = useRef<RunNowForm | null>(null);
  const startRun = useStartRoutineRun(routine, () => setOpenForm(null));
  const scheduleRun = useScheduleOneTimeRun(routine, () => setOpenForm(null));
  // aria-disabled instead of disabled keeps keyboard focus on the button after it is pressed.
  const isUnavailable = isRunning || startRun.isPending;
  const error = openForm === null ? (startRun.error ?? scheduleRun.error) : null;
  const startedCount = startRun.isSuccess ? (startRun.variables?.runs ?? runs) : null;
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
    startRun.mutate(undefined);
  }

  // A routine that is running answers with why, which the form shows.
  function runSeveral(request: StartRunRequest) {
    if (startRun.isPending) return;
    scheduleRun.reset();
    startRun.mutate(request);
  }

  function runLater(at: Date) {
    startRun.reset();
    scheduleRun.mutate(at);
  }

  function toggleForm(form: RunNowForm | null) {
    startRun.reset();
    scheduleRun.reset();
    setOpenForm(form);
    if (form !== null) setShownForm(form);
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <span role="status" className="sr-only">
        {startRun.isSuccess &&
          (startedCount === 1
            ? `Started a run of ${routine}`
            : `Started ${startedCount} runs of ${routine}`)}
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
      <Popover.Root
        open={openForm !== null}
        onOpenChange={isOpen => {
          if (!isOpen) toggleForm(null);
        }}
      >
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
                <Loader aria-hidden="true" className="size-3.5 spin-in-place" />
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
                      const form = requestedForm.current;
                      if (form === null) return;
                      requestedForm.current = null;
                      event.preventDefault();
                      toggleForm(form);
                    }}
                  >
                    {menu}
                    <DropdownMenu.Item
                      disabled={isUnavailable}
                      onSelect={() => {
                        requestedForm.current = 'several';
                      }}
                    >
                      <Repeat aria-hidden="true" />
                      Run several times…
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <RunLaterMenuItems
                      onSchedule={runLater}
                      onPickTime={() => {
                        requestedForm.current = 'later';
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
          aria-label={match(shownForm)
            .with('several', () => `Run ${routine} several times`)
            .with('later', () => `Run ${routine} once later`)
            .exhaustive()}
          onClick={event => event.stopPropagation()}
          // It opens from the menu, which has no trigger of its own to return the focus to.
          onCloseAutoFocus={event => {
            event.preventDefault();
            menuTriggerRef.current?.focus();
          }}
        >
          {match(shownForm)
            .with('several', () => (
              <RunSeveralForm
                routine={routine}
                isPending={startRun.isPending}
                error={startRun.error?.message ?? null}
                onSubmit={runSeveral}
                onCancel={() => toggleForm(null)}
              />
            ))
            .with('later', () => (
              <RunLaterForm
                routine={routine}
                isPending={scheduleRun.isPending}
                error={scheduleRun.error?.message ?? null}
                onSubmit={runLater}
                onCancel={() => toggleForm(null)}
              />
            ))
            .exhaustive()}
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
