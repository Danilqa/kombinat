import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoutineName } from 'domains/routine/ids';
import {
  addRoutine,
  cancelOneTimeRun,
  cancelQueuedRuns,
  getRoutine,
  getRoutines,
  saveRoutineMemory,
  scheduleOneTimeRun,
  startRoutineRun,
  startRoutineRunWithPrompt,
} from 'domains/routine/requests';
import type { AddRoutineRequest, AddedRoutine, StartRunRequest } from 'domains/routine/types';
import type { RunId } from 'domains/run/ids';
import { api } from '@web-app/api';
import { getPollInterval, type PollingOptions } from '@web-app/polling';
import {
  QUERY_KEYS_CHANGED_BY_ADDING,
  QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS,
  QUERY_KEYS_CHANGED_BY_RUN,
  ROUTINES_QUERY_KEY,
  invalidateQueryKeys,
} from '@web-app/query-keys';

export function useRoutines({ isPolling = false }: PollingOptions = {}) {
  return useQuery({
    queryKey: ROUTINES_QUERY_KEY,
    queryFn: () => getRoutines(api),
    refetchInterval: isPolling
      ? query => getPollInterval(query.state.data?.some(routine => routine.running) === true)
      : false,
  });
}

interface RoutineQueryOptions extends PollingOptions {
  isEnabled?: boolean;
}

export function useRoutine(
  name: RoutineName,
  { isPolling = false, isEnabled = true }: RoutineQueryOptions = {},
) {
  return useQuery({
    queryKey: [...ROUTINES_QUERY_KEY, name],
    queryFn: () => getRoutine(api, name),
    refetchInterval: isPolling
      ? query => getPollInterval(query.state.data?.running === true)
      : false,
    enabled: isEnabled,
  });
}

// onSuccess is a parameter of the hook, since one passed to mutate() waits for the queries to be
// read again and is dropped once the component unmounts.
export function useStartRoutineRun(routine: RoutineName, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request?: StartRunRequest) => startRoutineRun(api, routine, request),
    onSuccess: () => {
      onSuccess();
      return invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_RUN);
    },
  });
}

export function useStartRoutineRunByName(onSuccess: (routine: RoutineName) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routine: RoutineName) => startRoutineRun(api, routine),
    onSuccess: (_, routine) => {
      void invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_RUN);
      onSuccess(routine);
    },
  });
}

interface RunWithPromptRequest {
  routine: RoutineName;
  prompt: string;
}

export function useStartRoutineRunWithPrompt(
  onSuccess: (runId: RunId, routine: RoutineName) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ routine, prompt }: RunWithPromptRequest) =>
      startRoutineRunWithPrompt(api, routine, prompt),
    onSuccess: (runId, { routine }) => {
      void invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_RUN);
      onSuccess(runId, routine);
    },
  });
}

export function useScheduleOneTimeRun(routine: RoutineName, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (at: Date) => scheduleOneTimeRun(api, routine, at.toISOString()),
    onSuccess: () => {
      onSuccess();
      return invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS);
    },
  });
}

export function useCancelOneTimeRun(routine: RoutineName, onSuccess: (at: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (at: string) => cancelOneTimeRun(api, routine, at),
    onSuccess: (_, at) => onSuccess(at),
    onSettled: () => invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_ONE_TIME_RUNS),
  });
}

export function useCancelQueuedRuns(routine: RoutineName, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelQueuedRuns(api, routine),
    onSuccess: () => onSuccess(),
    onSettled: () => invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_RUN),
  });
}

export function useSaveRoutineMemory(routine: RoutineName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => saveRoutineMemory(api, routine, text),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...ROUTINES_QUERY_KEY, routine] }),
  });
}

export function useAddRoutine(onSuccess: (added: AddedRoutine) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AddRoutineRequest) => addRoutine(api, request),
    onSuccess: added => {
      void invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_ADDING);
      onSuccess(added);
    },
  });
}
