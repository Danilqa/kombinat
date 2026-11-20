import { useId, useState, type SubmitEvent } from 'react';

import { Button } from 'design-system/components';

import { getTomorrowMorning } from '../../scheduler/utils';
import type { RoutineName } from '../ids';

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getInputError(value: string): string | null {
  const at = new Date(value);
  if (value === '' || Number.isNaN(at.getTime())) return 'Choose a date and time';
  if (at.getTime() <= Date.now()) return 'Choose a time in the future';
  return null;
}

interface RunLaterFormProps {
  routine: RoutineName;
  isPending: boolean;
  error: string | null;
  onSubmit: (at: Date) => void;
  onCancel: () => void;
}

export function RunLaterForm({ routine, isPending, error, onSubmit, onCancel }: RunLaterFormProps) {
  const inputId = useId();
  const errorId = useId();
  const [initial] = useState(() => {
    const now = new Date();
    return { min: toLocalInputValue(now), value: toLocalInputValue(getTomorrowMorning(now)) };
  });
  const [value, setValue] = useState(initial.value);
  const [inputError, setInputError] = useState<string | null>(null);
  const shownError = inputError ?? error;

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const problem = getInputError(value);
    setInputError(problem);
    if (problem === null && !isPending) onSubmit(new Date(value));
  }

  return (
    <form noValidate onSubmit={submit} className="w-64 max-w-full space-y-3 py-1">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-body-sm font-medium wrap-break-word text-fg">
          Run {routine} once at
        </label>
        <input
          id={inputId}
          type="datetime-local"
          value={value}
          min={initial.min}
          required
          aria-invalid={shownError !== null || undefined}
          aria-describedby={shownError === null ? undefined : errorId}
          onChange={event => {
            setValue(event.target.value);
            setInputError(null);
          }}
          className="h-8 w-full rounded-md border border-line bg-page px-2.5 text-body-sm text-fg tabular-nums outline-none focus-visible:border-line-strong aria-invalid:border-negative max-sm:h-11"
        />
        {shownError !== null && (
          <p id={errorId} role="alert" className="text-body-sm text-negative">
            {shownError}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="tertiary" size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="small" aria-disabled={isPending || undefined}>
          Schedule run
        </Button>
      </div>
    </form>
  );
}
