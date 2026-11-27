import { useId, useState, type ReactNode, type SubmitEvent } from 'react';
import { ChevronDown, Loader, Plus, RotateCcw } from 'lucide-react';
import { match } from 'ts-pattern';
import { Button, Card, SectionHeader, cn } from 'design-system';
import { agentNameSchema } from 'domains/agent/schemas';
import type { AgentName, AgentOption } from 'domains/agent/types';
import { getAgentLabel } from 'domains/agent/utils';
import { ROUTINE_NAME_PATTERN } from 'domains/routine/constants';
import type { AddRoutineRequest, RoutineSummary, RoutineTemplate } from 'domains/routine/types';
import { describeScheduleValue } from 'domains/routine/utils';
import { PromptEditor } from '../prompt-editor';

const INPUT_CLASS_NAME =
  'h-8 w-full rounded-md border border-line bg-page px-2.5 font-mono text-body-sm text-fg placeholder:text-fg-faint focus-visible:border-line-strong aria-invalid:border-negative max-sm:h-11';

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

interface SelectProps {
  id: string;
  value: string;
  isInvalid: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}

function Select({ id, value, isInvalid, onChange, children }: SelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-invalid={isInvalid}
        aria-describedby={`${id}-hint`}
        className={cn(INPUT_CLASS_NAME, 'appearance-none pr-8')}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}

// The template's model stays in the list even when the machine doesn't name it.
function getModels(option: AgentOption | undefined, model: string | null): string[] {
  const models = option?.models ?? [];
  return model === null || models.includes(model) ? models : [model, ...models];
}

function getModelHint(agent: AgentName, model: string | null, template: RoutineTemplate): string {
  if (model === null) return `The model ${getAgentLabel(agent)} is set up to use`;
  if (agent === template.agent && model === template.model) return 'The model of the template';
  return template.model === null
    ? 'The template leaves the model to the agent'
    : `The template uses ${template.model}`;
}

interface SubmitProps {
  isPending: boolean;
  error: string | null;
  className?: string;
}

function Submit({ isPending, error, className }: SubmitProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Button type="submit" className="w-full max-sm:h-11" aria-disabled={isPending || undefined}>
        {isPending ? (
          <Loader aria-hidden="true" className="size-3.5 spin-in-place" />
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
    </div>
  );
}

interface AddRoutineFormProps {
  template: RoutineTemplate;
  routines: RoutineSummary[];
  agents: AgentOption[];
  agent: AgentName;
  model: string | null;
  isPending: boolean;
  error: string | null;
  onAgentChange: (agent: AgentName) => void;
  onModelChange: (model: string | null) => void;
  onSubmit: (request: AddRoutineRequest) => void;
}

export function AddRoutineForm({
  template,
  routines,
  agents,
  agent,
  model,
  isPending,
  error,
  onAgentChange,
  onModelChange,
  onSubmit,
}: AddRoutineFormProps) {
  const nameId = useId();
  const cwdId = useId();
  const scheduleId = useId();
  const agentId = useId();
  const modelId = useId();
  const [typedName, setTypedName] = useState<string | null>(null);
  const [cwd, setCwd] = useState(template.cwd);
  const [schedule, setSchedule] = useState(template.schedule ?? 'manual');
  const [prompt, setPrompt] = useState(template.prompt);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const name = typedName ?? getFreeName(template, routines);
  const nameError = getNameError(name, routines);
  const scheduleLabel = describeScheduleValue(schedule);
  const scheduleError =
    scheduleLabel === null ? 'Enter a cron schedule, such as 0 9 * * 1-5, or manual' : null;
  const cwdError = isSubmitted && cwd.trim() === '' ? 'Enter the folder the agent works in' : null;
  const agentOption = agents.find(option => option.name === agent);
  const hasAgentChoice = agents.some(option => option.name === template.agent);
  const isAgentMissing = agentOption?.isInstalled === false;
  const isPromptBlank = prompt.trim() === '';
  const isPromptChanged = prompt !== template.prompt;
  const promptHint = match(template.agent)
    .with('command', () => 'The command gets this text as its input')
    .with('claude', 'codex', () => 'Change it to fit your project')
    .exhaustive();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    setIsSubmitted(true);
    if (
      isPending ||
      nameError !== null ||
      scheduleError !== null ||
      cwd.trim() === '' ||
      isPromptBlank
    ) {
      return;
    }
    onSubmit({
      template: template.id,
      name,
      cwd: cwd.trim(),
      schedule: schedule.trim(),
      agent,
      model,
      prompt,
    });
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <section className="min-w-0 lg:col-start-2 lg:row-start-1">
          <SectionHeader.Root>Add to your routines</SectionHeader.Root>
          <Card.Root className="gap-4 p-5">
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
            <Field id={cwdId} label="Working directory" hint={template.folderHint} error={cwdError}>
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
            {hasAgentChoice && (
              <>
                <Field
                  id={agentId}
                  label="Agent"
                  hint="Installed on this machine"
                  error={
                    isAgentMissing
                      ? `${getAgentLabel(agent)} isn't installed on this machine`
                      : null
                  }
                >
                  <Select
                    id={agentId}
                    value={agent}
                    isInvalid={isAgentMissing}
                    onChange={value => onAgentChange(agentNameSchema.parse(value))}
                  >
                    {agents.map(option => (
                      <option
                        key={option.name}
                        value={option.name}
                        disabled={!option.isInstalled && option.name !== agent}
                      >
                        {getAgentLabel(option.name)}
                        {option.isInstalled ? '' : ' (not installed)'}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  id={modelId}
                  label="Model"
                  hint={getModelHint(agent, model, template)}
                  error={null}
                >
                  <Select
                    id={modelId}
                    value={model ?? ''}
                    isInvalid={false}
                    onChange={value => onModelChange(value === '' ? null : value)}
                  >
                    {(model === null || agent !== template.agent) && (
                      <option value="">Default</option>
                    )}
                    {getModels(agentOption, model).map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            <Submit isPending={isPending} error={error} className="max-lg:hidden" />
          </Card.Root>
        </section>
        <section className="min-w-0 lg:col-start-1 lg:row-start-1">
          <SectionHeader.Root>Prompt</SectionHeader.Root>
          <PromptEditor
            value={prompt}
            submitLabel="add"
            inputClassName="field-sizing-content min-h-48"
            onChange={setPrompt}
            footer={
              <span className="flex min-h-7 min-w-0 items-center gap-2">
                {isSubmitted && isPromptBlank ? (
                  <span className="text-negative">Enter a prompt for the agent</span>
                ) : (
                  <span className="min-w-0 truncate">
                    {isPromptChanged ? 'Changed from the template' : promptHint}
                  </span>
                )}
                {isPromptChanged && (
                  <Button
                    type="button"
                    variant="tertiary"
                    size="small"
                    onClick={() => setPrompt(template.prompt)}
                  >
                    <RotateCcw aria-hidden="true" />
                    Reset
                  </Button>
                )}
              </span>
            }
          />
        </section>
      </div>
      {/* Below the two columns, the form is longer than the screen, so the button stays in reach. */}
      <div className="sticky bottom-0 z-10 bg-linear-to-t from-page from-70% to-transparent pt-6 pb-[calc(--spacing(4)+env(safe-area-inset-bottom))] lg:hidden">
        <Submit isPending={isPending} error={error} className="sm:ml-auto sm:w-60" />
      </div>
    </form>
  );
}
