import { useQuery } from '@tanstack/react-query';

import { getInbox } from 'domains/inbox/requests';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';

export function useInbox() {
  return useQuery({
    queryKey: ['inbox'],
    queryFn: () => getInbox(sameOriginApi),
    refetchInterval: getPollInterval(false),
  });
}
