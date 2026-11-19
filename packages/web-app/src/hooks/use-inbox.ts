import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getInbox } from 'domains/inbox/requests';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';

export function useInbox() {
  // The installed app keeps polling in the background, so the badge on its icon stays current.
  const [isInstalledApp] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  return useQuery({
    queryKey: ['inbox'],
    queryFn: () => getInbox(sameOriginApi),
    refetchInterval: getPollInterval(false),
    refetchIntervalInBackground: isInstalledApp,
  });
}
