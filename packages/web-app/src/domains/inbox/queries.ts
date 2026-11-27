import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isMatching } from 'ts-pattern';

import { getInbox, markRunsRead, setNotifyLevel } from 'domains/inbox/requests';
import type { Inbox, InboxRunKey, NotifyLevel } from 'domains/inbox/types';
import type { RoutineName } from 'domains/routine/ids';
import { api } from '@web-app/api';
import { readNotificationAccess } from '@web-app/hooks';
import { getPollInterval } from '@web-app/polling';
import { INBOX_QUERY_KEY } from '@web-app/query-keys';

export function useInbox() {
  const queryClient = useQueryClient();
  const [isInstalledApp] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const notify = queryClient.getQueryData<Inbox>(INBOX_QUERY_KEY)?.notify ?? {};
  const isNotifying =
    Object.keys(notify).length > 0 && isMatching('granted', readNotificationAccess());
  return useQuery({
    queryKey: INBOX_QUERY_KEY,
    queryFn: () => getInbox(api),
    refetchInterval: getPollInterval(false),
    // The installed app keeps polling in the background, so the badge on its icon stays current,
    // and so does a tab that shows notifications.
    refetchIntervalInBackground: isInstalledApp || isNotifying,
  });
}

export function useMarkRunsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runs: InboxRunKey[]) => markRunsRead(api, runs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY }),
  });
}

export function useSetNotifyLevel(routine: RoutineName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (level: NotifyLevel) => setNotifyLevel(api, routine, level),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY }),
  });
}
