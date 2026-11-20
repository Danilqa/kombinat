import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isMatching } from 'ts-pattern';

import { getInbox } from 'domains/inbox/requests';
import type { Inbox } from 'domains/inbox/types';
import { sameOriginApi } from 'utils/http';
import { getPollInterval } from 'utils/polling';
import { readNotificationAccess } from '@web-app/hooks/use-notification-permission';

const INBOX_QUERY_KEY = ['inbox'];

export function useInbox() {
  const queryClient = useQueryClient();
  const [isInstalledApp] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const notify = queryClient.getQueryData<Inbox>(INBOX_QUERY_KEY)?.notify ?? {};
  const isNotifying =
    Object.keys(notify).length > 0 && isMatching('granted', readNotificationAccess());
  return useQuery({
    queryKey: INBOX_QUERY_KEY,
    queryFn: () => getInbox(sameOriginApi),
    refetchInterval: getPollInterval(false),
    // The installed app keeps polling in the background, so the badge on its icon stays current,
    // and so does a tab that shows notifications.
    refetchIntervalInBackground: isInstalledApp || isNotifying,
  });
}
