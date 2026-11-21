import { useState, type SubmitEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, Play, RotateCcw } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Button, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { QUERY_KEYS_CHANGED_BY_RUN } from 'domains/routine/constants';
import { routineNameSchema } from 'domains/routine/ids';
import { getRoutine, startRoutineRunWithPrompt } from 'domains/routine/requests';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { PromptEditor } from '@web-app/components/prompt-editor';
import { ROUTINES_PATH, getRoutinePath, getRunPath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

const FORM_ID = 'change-prompt';

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
          <PromptEditor
            value={prompt}
            onChange={setChangedPrompt}
            footer={
              <span className="min-w-0 truncate">
                {isChanged ? 'Changed for this run' : data.file}
              </span>
            }
          />
        </form>
      )}
    </div>
  );
}
