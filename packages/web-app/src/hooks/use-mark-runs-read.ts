import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markRunsRead } from 'domains/inbox/requests';
import type { InboxRunKey } from 'domains/inbox/types';
import { sameOriginApi } from 'utils/http';

export function useMarkRunsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runs: InboxRunKey[]) => markRunsRead(sameOriginApi, runs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  });
}
