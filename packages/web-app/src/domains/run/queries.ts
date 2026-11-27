import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';

import type { RoutineName } from 'domains/routine/ids';
import type { RunId } from 'domains/run/ids';
import {
  allowBlockedActions,
  getRunsPage,
  getRunWithTranscript,
  removeRunWorktree,
  searchRuns,
  sendRunMessage,
  sendWaitAction,
} from 'domains/run/requests';
import type { RunRecord, RunsCursor, RunsPage, UsageLimitWaitAction } from 'domains/run/types';
import { checkIsRunActive, compareRunsByNewest } from 'domains/run/utils';
import { api } from '@web-app/api';
import { getPollInterval } from '@web-app/polling';
import {
  QUERY_KEYS_CHANGED_BY_ALLOW,
  QUERY_KEYS_CHANGED_BY_MESSAGE,
  QUERY_KEYS_CHANGED_BY_WAIT_ACTION,
  QUERY_KEYS_CHANGED_BY_WORKTREE,
  RUNS_QUERY_KEY,
  invalidateQueryKeys,
} from '@web-app/query-keys';

// A run writes its record once its before hook is done, which takes up to three minutes.
const START_RETRIES = 200;
const START_RETRY_MS = 1000;

interface LoadedRuns {
  runs: RunRecord[];
  total: number;
}

export interface RunsQuery {
  data: LoadedRuns | undefined;
  error: Error | null;
  isPending: boolean;
  isFetchingNextPage: boolean;
  loadNextPage: () => void;
}

function checkHasActiveRun(data: InfiniteData<RunsPage> | undefined): boolean {
  return data?.pages.some(page => page.runs.some(checkIsRunActive)) === true;
}

function checkIsBehind(loadedRun: RunRecord | undefined, latestRun: RunRecord | null): boolean {
  if (latestRun === null) return false;
  if (loadedRun === undefined) return true;
  return compareRunsByNewest(latestRun, loadedRun) < 0 || loadedRun.status !== latestRun.status;
}

function toLoadedRuns(data: InfiniteData<RunsPage>): LoadedRuns {
  return { runs: data.pages.flatMap(page => page.runs), total: data.pages[0]?.total ?? 0 };
}

export function useRuns(
  routine: RoutineName | null,
  latestRun: RunRecord | null = null,
): RunsQuery {
  const [endReachedAt, setEndReachedAt] = useState<number | null>(null);
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useInfiniteQuery<RunsPage, Error, LoadedRuns, QueryKey, RunsCursor | null>({
      queryKey: routine === null ? RUNS_QUERY_KEY : [...RUNS_QUERY_KEY, { routine }],
      queryFn: ({ pageParam }) => getRunsPage(api, routine, pageParam),
      initialPageParam: null,
      getNextPageParam: page => page.nextCursor,
      select: toLoadedRuns,
      refetchInterval: query => getPollInterval(checkHasActiveRun(query.state.data)),
    });
  // The routine query can see a new run, or the end of one, before these pages do.
  const isBehind = data !== undefined && checkIsBehind(data.runs[0], latestRun);
  useEffect(() => {
    if (isBehind) void refetch();
  }, [isBehind, refetch]);
  const loadedCount = data?.runs.length ?? null;
  const isNextPageDue =
    hasNextPage && !isFetchingNextPage && error === null && endReachedAt === loadedCount;
  // The table reports its end once, and a refetch can drop the page on its way between two renders.
  useEffect(() => {
    if (isNextPageDue) void fetchNextPage();
  });
  return {
    data,
    error,
    isPending,
    isFetchingNextPage,
    loadNextPage: () => setEndReachedAt(loadedCount),
  };
}

export function useRunsSearch(search: string) {
  return useQuery({
    queryKey: [...RUNS_QUERY_KEY, { search }],
    queryFn: () => searchRuns(api, search),
    placeholderData: keepPreviousData,
  });
}

interface RunQueryOptions {
  isStarting: boolean;
}

export function useRun(routine: RoutineName, id: RunId, { isStarting }: RunQueryOptions) {
  return useQuery({
    queryKey: [...RUNS_QUERY_KEY, routine, id],
    queryFn: () => getRunWithTranscript(api, routine, id),
    refetchInterval: query =>
      getPollInterval(query.state.data !== undefined && checkIsRunActive(query.state.data.run)),
    retry: isStarting && START_RETRIES,
    retryDelay: START_RETRY_MS,
  });
}

// onSuccess is a parameter of the hook, since one passed to mutate() waits for the queries to be
// read again and is dropped once the component unmounts.
export function useSendRunMessage(routine: RoutineName, id: RunId, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => sendRunMessage(api, routine, id, message),
    onSuccess: () => {
      onSuccess();
      return invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_MESSAGE);
    },
  });
}

export function useAllowBlockedActions(routine: RoutineName, id: RunId, onSuccess: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => allowBlockedActions(api, routine, id),
    onSuccess: () => {
      onSuccess();
      return invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_ALLOW);
    },
  });
}

export function useSendWaitAction(
  routine: RoutineName,
  id: RunId,
  onSuccess: (action: UsageLimitWaitAction) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: UsageLimitWaitAction) => sendWaitAction(api, routine, id, action),
    onSuccess: (_, action) => {
      onSuccess(action);
      return invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_WAIT_ACTION);
    },
  });
}

export function useRemoveRunWorktree(routine: RoutineName, id: RunId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeRunWorktree(api, routine, id),
    onSuccess: () => invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_WORKTREE),
  });
}
