import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { watchDaemonChanges } from 'domains/daemon/requests';
import { sameOriginApi } from 'utils/http';

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
      void watchDaemonChanges(
        sameOriginApi,
        () => void queryClient.invalidateQueries(),
        controller.signal,
      );
    };
    follow();
    document.addEventListener('visibilitychange', follow);
    return () => {
      document.removeEventListener('visibilitychange', follow);
      controller?.abort();
    };
  }, [queryClient]);
}
