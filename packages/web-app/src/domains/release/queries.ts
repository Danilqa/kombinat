import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReleaseVersion } from 'domains/release/ids';
import { getReleaseUpdate, skipRelease } from 'domains/release/requests';
import type { ReleaseUpdate } from 'domains/release/types';
import { api } from '@web-app/api';
import { RELEASES_QUERY_KEY } from '@web-app/query-keys';

const POLL_MS = 5 * 60_000;

export function useReleaseUpdate() {
  return useQuery({
    queryKey: RELEASES_QUERY_KEY,
    queryFn: () => getReleaseUpdate(api),
    refetchInterval: POLL_MS,
  });
}

// The version counts as skipped at once, before the daemon has saved it.
export function useSkipRelease() {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (version: ReleaseVersion) => skipRelease(api, version),
    onSettled: () => queryClient.invalidateQueries({ queryKey: RELEASES_QUERY_KEY }),
  });
  return (version: ReleaseVersion) => {
    queryClient.setQueryData<ReleaseUpdate>(
      RELEASES_QUERY_KEY,
      current => current && { ...current, skippedVersion: version },
    );
    mutate(version);
  };
}
