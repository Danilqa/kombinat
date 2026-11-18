import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { watchDaemonChanges } from 'domains/daemon/requests';
import { sameOriginApi } from 'utils/http';

export function useLiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const controller = new AbortController();
    void watchDaemonChanges(
      sameOriginApi,
      () => void queryClient.invalidateQueries(),
      controller.signal,
    );
    return () => controller.abort();
  }, [queryClient]);
}
