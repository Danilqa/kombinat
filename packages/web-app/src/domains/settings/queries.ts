import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from 'domains/settings/requests';
import { api } from '@web-app/api';
import {
  QUERY_KEYS_CHANGED_BY_CLEANUP,
  SETTINGS_QUERY_KEY,
  invalidateQueryKeys,
} from '@web-app/query-keys';

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => getSettings(api),
  });
}

export function useUpdateRunRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runRetentionDays: number | null) => updateSettings(api, { runRetentionDays }),
    onSuccess: settings => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, settings);
      return invalidateQueryKeys(queryClient, QUERY_KEYS_CHANGED_BY_CLEANUP);
    },
  });
}
