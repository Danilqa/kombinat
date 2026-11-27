import { useId, useState, type SubmitEvent } from 'react';
import { match } from 'ts-pattern';

import { Button, cn } from 'design-system';
import type { RoutineName } from 'domains/routine/ids';
import type { StartRunRequest } from 'domains/routine/types';
import { MAX_RUNS } from 'domains/run/constants';

const MIN_RUNS = 2;
const DEFAULT_RUNS = 3;

type RunPace = 'queue' | 'parallel';

interface PaceOption {
  pace: RunPace;
  label: string;
}

const PACE_OPTIONS: PaceOption[] = [
  { pace: 'queue', label: 'One after another' },
  { pace: 'parallel', label: 'All at once' },
];

function parseRuns(value: string): number | null {
  const runs = Number(value);
  return value.trim() !== '' && Number.isInteger(runs) && runs >= MIN_RUNS && runs <= MAX_RUNS
    ? runs
    : null;
}

interface RunSeveralFormProps {
  routine: RoutineName;
  isPending: boolean;
  error: string | null;
  onSubmit: (request: StartRunRequest) => void;
  onCancel: () => void;
}

export function RunSeveralForm({
  routine,
  isPending,
  error,
  onSubmit,
  onCancel,
}: RunSeveralFormProps) {
  const inputId = useId();
  const errorId = useId();
  const paceName = useId();
  const [value, setValue] = useState(String(DEFAULT_RUNS));
  const [pace, setPace] = useState<RunPace>('queue');
  const [inputError, setInputError] = useState<string | null>(null);
  const runs = parseRuns(value);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (runs === null) {
      setInputError(`Enter a number from ${MIN_RUNS} to ${MAX_RUNS}`);
      return;
    }
    const maxParallel = match(pace)
      .with('queue', () => 1)
      .with('parallel', () => runs)
      .exhaustive();
    if (!isPending) onSubmit({ runs, maxParallel });
  }

  return (
    <form noValidate onSubmit={submit} className="w-64 max-w-full space-y-3 py-1">
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-body-sm font-medium wrap-break-word text-fg">
          Run {routine}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={MIN_RUNS}
            max={MAX_RUNS}
            value={value}
            required
            aria-invalid={inputError !== null || undefined}
            aria-describedby={inputError === null ? undefined : errorId}
            onChange={event => {
              setValue(event.target.value);
              setInputError(null);
            }}
            className="h-8 w-20 rounded-md border border-line bg-page px-2.5 text-body-sm text-fg tabular-nums focus-visible:border-line-strong aria-invalid:border-negative max-sm:h-11"
          />
          <span className="text-body-sm text-fg-secondary">times</span>
        </div>
        {inputError !== null && (
          <p id={errorId} role="alert" className="text-body-sm text-negative">
            {inputError}
          </p>
        )}
      </div>
      <fieldset className="grid grid-cols-2 gap-1 rounded-md border border-line bg-page p-0.5">
        <legend className="sr-only">How the runs start</legend>
        {PACE_OPTIONS.map(option => (
          <label
            key={option.pace}
            className={cn(
              'flex h-7 cursor-pointer items-center justify-center rounded-sm px-2 text-center text-body-sm whitespace-nowrap text-fg-secondary transition-colors hover:text-fg has-focus-visible:ring-2 has-focus-visible:ring-line-strong max-sm:h-10',
              pace === option.pace && 'bg-overlay text-fg',
            )}
          >
            <input
              type="radio"
              name={paceName}
              value={option.pace}
              checked={pace === option.pace}
              onChange={() => setPace(option.pace)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {/* Errors from the daemon, such as a routine that is running, are not about the number. */}
      {inputError === null && error !== null && (
        <p role="alert" className="text-body-sm wrap-break-word text-negative">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="tertiary" size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="small" aria-disabled={isPending || undefined}>
          {runs === null ? 'Start runs' : `Start ${runs} runs`}
        </Button>
      </div>
    </form>
  );
}
