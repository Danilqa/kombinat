import { useState, type KeyboardEvent, type SubmitEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, Play, RotateCcw } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button, Card, ErrorState, Kbd, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { QUERY_KEYS_CHANGED_BY_RUN } from 'domains/routine/constants';
import { routineNameSchema } from 'domains/routine/ids';
import { getRoutine, startRoutineRunWithPrompt } from 'domains/routine/requests';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { ROUTINES_PATH, getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { isApplePlatform } from '@web-app/hooks/use-search-shortcut';

const FORM_ID = 'change-prompt';
const RUN_SHORTCUT_LABEL = isApplePlatform ? '⌘↵' : 'Ctrl ↵';

function checkIsRunShortcut(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

export function ChangePromptPage() {
  const name = routineNameSchema.parse(useParams<'name'>().name ?? '');
  useDocumentTitle(`Change prompt of ${name}`);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [changedPrompt, setChangedPrompt] = useState<string | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ['routines', name],
    queryFn: () => getRoutine(sameOriginApi, name),
    refetchInterval: query => getPollInterval(query.state.data?.running === true),
  });
  const startRun = useMutation({
    mutationFn: (prompt: string) => startRoutineRunWithPrompt(sameOriginApi, name, prompt),
    onSuccess: runId => {
      for (const queryKey of QUERY_KEYS_CHANGED_BY_RUN) {
        void queryClient.invalidateQueries({ queryKey });
      }
      void navigate(getRunPath(name, runId), { state: { isStarting: true } });
    },
  });
  const prompt = changedPrompt ?? data?.prompt ?? '';
  const isChanged = changedPrompt !== null && changedPrompt !== data?.prompt;
  const isUnavailable = data?.running !== false || startRun.isPending || prompt.trim() === '';

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!isUnavailable) startRun.mutate(prompt);
  }

  // Back to the page it was opened from, or to the routine when the page was opened by its URL.
  function cancel() {
    if (location.key === 'default') void navigate(getRoutinePath(name));
    else void navigate(-1);
  }

  function submitOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!checkIsRunShortcut(event)) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div>
      <Breadcrumbs
        crumbs={[
          { label: 'Routines', to: ROUTINES_PATH },
          { label: name, to: getRoutinePath(name) },
        ]}
        aside={
          data && (
            <div className="flex min-w-0 items-center gap-2">
              {startRun.error && (
                <span
                  role="alert"
                  className="max-w-56 animate-in truncate text-body-sm text-negative duration-200 fade-in slide-in-from-right-1"
                  title={startRun.error.message}
                >
                  {startRun.error.message}
                </span>
              )}
              {isChanged && (
                <Button
                  type="button"
                  variant="tertiary"
                  size="small"
                  onClick={() => setChangedPrompt(null)}
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </Button>
              )}
              <Button type="button" variant="tertiary" size="small" onClick={cancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                size="small"
                aria-disabled={isUnavailable || undefined}
              >
                {startRun.isPending || data.running ? (
                  <Loader aria-hidden="true" className="spin-in-place size-3.5" />
                ) : (
                  <Play
                    aria-hidden="true"
                    className="size-3.5 fill-current transition-transform duration-200 ease-out-quint group-hover/button:translate-x-0.5"
                  />
                )}
                {data.running ? 'Running' : 'Run'}
              </Button>
            </div>
          )
        }
      />
      <header className="mb-6 space-y-1">
        <PageHeader.Title>Change prompt and run</PageHeader.Title>
        <p className="max-w-3xl text-body text-fg-secondary">
          The prompt below runs once. The routine file stays as it is.
        </p>
      </header>
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <form id={FORM_ID} onSubmit={submit}>
          <Card.Root className="gap-0 py-0 transition-colors focus-within:border-line-strong">
            <textarea
              aria-label="Prompt"
              value={prompt}
              onChange={event => setChangedPrompt(event.target.value)}
              onKeyDown={submitOnShortcut}
              spellCheck={false}
              className="min-h-[60vh] w-full resize-y bg-transparent p-6 font-mono text-body-sm/relaxed text-fg outline-none focus-visible:shadow-none"
            />
            <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-2.5 text-body-sm text-fg-muted">
              <span className="min-w-0 truncate">
                {isChanged ? 'Changed for this run' : data.file}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 max-sm:hidden">
                <Kbd>{RUN_SHORTCUT_LABEL}</Kbd> to run
              </span>
            </div>
          </Card.Root>
        </form>
      )}
    </div>
  );
}
