import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { isMatching } from 'ts-pattern';

import type { RoutineName } from 'domains/id/types';
import { getRunsPage } from 'domains/run/requests';
import type { RunRecord, RunsCursor, RunsPage } from 'domains/run/types';
import { compareRunsByNewest } from 'domains/run/utils';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';

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

function checkHasRunningRun(data: InfiniteData<RunsPage> | undefined): boolean {
  return data?.pages.some(page => page.runs.some(isMatching({ status: 'running' }))) === true;
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
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useInfiniteQuery<RunsPage, Error, LoadedRuns, QueryKey, RunsCursor | null>({
      queryKey: routine === null ? ['runs'] : ['runs', { routine }],
      queryFn: ({ pageParam }) => getRunsPage(sameOriginApi, routine, pageParam),
      initialPageParam: null,
      getNextPageParam: page => page.nextCursor,
      select: toLoadedRuns,
      refetchInterval: query => getPollInterval(checkHasRunningRun(query.state.data)),
    });
  // The routine query can see a new run, or the end of one, before these pages do.
  const isBehind = data !== undefined && checkIsBehind(data.runs[0], latestRun);
  useEffect(() => {
    if (isBehind) void refetch();
  }, [isBehind, refetch]);
  return {
    data,
    error,
    isPending,
    isFetchingNextPage,
    loadNextPage: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
  };
}
