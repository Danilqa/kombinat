import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getDaemonStatus, watchDaemonChanges } from 'domains/daemon/requests';
import { api } from '@web-app/api';
import { getPollInterval, type PollingOptions } from '@web-app/polling';
import { STATUS_QUERY_KEY } from '@web-app/query-keys';

export function useDaemonStatus({ isPolling = false }: PollingOptions = {}) {
  return useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: () => getDaemonStatus(api),
    refetchInterval: isPolling
      ? query => getPollInterval(query.state.data !== undefined && query.state.data.running > 0)
      : false,
  });
}

// Browsers allow 6 connections to a host across all tabs, so only a visible tab holds the stream.
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    let controller: AbortController | null = null;
    const follow = () => {
      controller?.abort();
      controller = null;
      if (document.hidden) return;
      controller = new AbortController();
      void watchDaemonChanges(api, () => void queryClient.invalidateQueries(), controller.signal);
    };
    follow();
    document.addEventListener('visibilitychange', follow);
    return () => {
      document.removeEventListener('visibilitychange', follow);
      controller?.abort();
    };
  }, [queryClient]);
}
