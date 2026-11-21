import { useState, type SubmitEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader, Play } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { Button, ErrorState, LoadingState } from 'design-system/components';
import { PageHeader } from 'design-system/layouts';
import { QUERY_KEYS_CHANGED_BY_RUN } from 'domains/routine/constants';
import type { RoutineName } from 'domains/routine/ids';
import { getRoutines, startRoutineRunWithPrompt } from 'domains/routine/requests';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { Breadcrumbs } from '@web-app/components/breadcrumbs';
import { PromptEditor } from '@web-app/components/prompt-editor';
import { RUNS_PATH, getRunPath } from '@web-app/constants/path';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';
import { RoutinePicker } from './routine-picker';

const FORM_ID = 'new-run';

interface NewRunRequest {
  routine: RoutineName;
  prompt: string;
}

export function NewRunPage() {
  useDocumentTitle('New run');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [routineName, setRoutineName] = useState<RoutineName | null>(null);
  const [prompt, setPrompt] = useState('');
  const { data, error, isPending } = useQuery({
    queryKey: ['routines'],
    queryFn: () => getRoutines(sameOriginApi),
    refetchInterval: query =>
      getPollInterval(query.state.data?.some(routine => routine.running) === true),
  });
  const startRun = useMutation({
    mutationFn: ({ routine, prompt: text }: NewRunRequest) =>
      startRoutineRunWithPrompt(sameOriginApi, routine, text),
    onSuccess: (runId, { routine }) => {
      for (const queryKey of QUERY_KEYS_CHANGED_BY_RUN) {
        void queryClient.invalidateQueries({ queryKey });
      }
      void navigate(getRunPath(routine, runId), { state: { isStarting: true } });
    },
  });
  const routine = data?.find(candidate => candidate.name === routineName) ?? null;
  const isRunning = routine?.running === true;
  const isUnavailable = routine === null || isRunning || startRun.isPending || prompt.trim() === '';

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!isUnavailable) startRun.mutate({ routine: routine.name, prompt });
  }

  function chooseRoutine(name: RoutineName) {
    startRun.reset();
    setRoutineName(name);
  }

  // Back to the page it was opened from, or to Runs when the page was opened by its URL.
  function cancel() {
    if (location.key === 'default') void navigate(RUNS_PATH);
    else void navigate(-1);
  }

  return (
    <div>
      <Breadcrumbs
        crumbs={[{ label: 'Runs', to: RUNS_PATH }, { label: 'New run' }]}
        aside={
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
            <Button type="button" variant="tertiary" size="small" onClick={cancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              size="small"
              aria-disabled={isUnavailable || undefined}
            >
              {startRun.isPending || isRunning ? (
                <Loader aria-hidden="true" className="spin-in-place size-3.5" />
              ) : (
                <Play
                  aria-hidden="true"
                  className="size-3.5 fill-current transition-transform duration-200 ease-out-quint group-hover/button:translate-x-0.5"
                />
              )}
              {isRunning ? 'Running' : 'Run'}
            </Button>
          </div>
        }
      />
      <header className="mb-6 space-y-1">
        <PageHeader.Title>New run</PageHeader.Title>
        <p className="max-w-3xl text-body text-fg-secondary">
          The prompt runs once in a routine&apos;s folder, with its agent and settings. The routine
          file stays as it is.
        </p>
      </header>
      {error && <ErrorState message={error.message} />}
      {isPending && <LoadingState />}
      {data && (
        <form id={FORM_ID} onSubmit={submit}>
          <PromptEditor
            value={prompt}
            onChange={setPrompt}
            placeholder="What should the agent do?"
            autoFocus
            header={
              <>
                <RoutinePicker routines={data} value={routineName} onChange={chooseRoutine} />
                {routine && (
                  <span className="min-w-0 truncate" title={routine.cwd}>
                    {routine.cwd}
                  </span>
                )}
              </>
            }
          />
        </form>
      )}
    </div>
  );
}
