import { useId, useState, type ReactNode, type SubmitEvent } from 'react';
import { Loader, Plus } from 'lucide-react';
import { Button } from 'design-system/components';
import { cn } from 'design-system/utils';
import { ROUTINE_NAME_PATTERN } from 'domains/routine/constants';
import type { AddRoutineRequest, RoutineSummary, RoutineTemplate } from 'domains/routine/types';
import { describeScheduleValue } from 'domains/routine/utils';

const INPUT_CLASS_NAME =
  'h-8 w-full rounded-md border border-line bg-page px-2.5 font-mono text-body-sm text-fg outline-none placeholder:text-fg-faint focus-visible:border-line-strong aria-invalid:border-negative max-sm:h-11';

function getFreeName(template: RoutineTemplate, routines: RoutineSummary[]): string {
  const taken = new Set<string>(routines.map(routine => routine.name));
  if (!taken.has(template.id)) return template.id;
  let count = 2;
  while (taken.has(`${template.id}-${count}`)) count += 1;
  return `${template.id}-${count}`;
}

function getNameError(name: string, routines: RoutineSummary[]): string | null {
  if (name === '') return 'Enter a name for the routine';
  if (!ROUTINE_NAME_PATTERN.test(name)) {
    return 'Use lowercase letters, numbers and dashes, such as my-routine';
  }
  if (routines.some(routine => routine.name === name)) {
    return 'A routine with this name exists. Choose another name';
  }
  return null;
}

interface FieldProps {
  id: string;
  label: string;
  hint: ReactNode;
  error: string | null;
  children: ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-body-sm font-medium text-fg">
        {label}
      </label>
      {children}
      <p
        id={`${id}-hint`}
        className={cn(
          'text-body-sm wrap-anywhere',
          error === null ? 'text-fg-muted' : 'text-negative',
        )}
      >
        {error ?? hint}
      </p>
    </div>
  );
}

interface AddRoutineFormProps {
  template: RoutineTemplate;
  routines: RoutineSummary[];
  isPending: boolean;
  error: string | null;
  onSubmit: (request: AddRoutineRequest) => void;
}

export function AddRoutineForm({
  template,
  routines,
  isPending,
  error,
  onSubmit,
}: AddRoutineFormProps) {
  const nameId = useId();
  const cwdId = useId();
  const scheduleId = useId();
  const [typedName, setTypedName] = useState<string | null>(null);
  const [cwd, setCwd] = useState(template.cwd);
  const [schedule, setSchedule] = useState(template.schedule ?? 'manual');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const name = typedName ?? getFreeName(template, routines);
  const nameError = getNameError(name, routines);
  const scheduleLabel = describeScheduleValue(schedule);
  const scheduleError =
    scheduleLabel === null ? 'Enter a cron schedule, such as 0 9 * * 1-5, or manual' : null;
  const cwdError = isSubmitted && cwd.trim() === '' ? 'Enter the folder the agent works in' : null;

  function submit(event: SubmitEvent) {
    event.preventDefault();
    setIsSubmitted(true);
    if (isPending || nameError !== null || scheduleError !== null || cwd.trim() === '') return;
    onSubmit({ template: template.id, name, cwd: cwd.trim(), schedule: schedule.trim() });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <Field
        id={nameId}
        label="Name"
        hint={`routines/${name}.md`}
        error={typedName === null && !isSubmitted ? null : nameError}
      >
        <input
          id={nameId}
          value={name}
          onChange={event => setTypedName(event.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={(typedName !== null || isSubmitted) && nameError !== null}
          aria-describedby={`${nameId}-hint`}
          className={INPUT_CLASS_NAME}
        />
      </Field>
      <Field id={cwdId} label="Folder" hint={template.folderHint} error={cwdError}>
        <input
          id={cwdId}
          value={cwd}
          onChange={event => setCwd(event.target.value)}
          placeholder="~/code/my-app"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={cwdError !== null}
          aria-describedby={`${cwdId}-hint`}
          className={INPUT_CLASS_NAME}
        />
      </Field>
      <Field id={scheduleId} label="Schedule" hint={scheduleLabel} error={scheduleError}>
        <input
          id={scheduleId}
          value={schedule}
          onChange={event => setSchedule(event.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={scheduleError !== null}
          aria-describedby={`${scheduleId}-hint`}
          className={INPUT_CLASS_NAME}
        />
      </Field>
      <Button type="submit" className="w-full max-sm:h-11" aria-disabled={isPending || undefined}>
        {isPending ? (
          <Loader aria-hidden="true" className="spin-in-place size-3.5" />
        ) : (
          <Plus aria-hidden="true" />
        )}
        Add routine
      </Button>
      {error !== null && (
        <p role="alert" className="text-body-sm wrap-anywhere text-negative">
          {error}
        </p>
      )}
    </form>
  );
}
