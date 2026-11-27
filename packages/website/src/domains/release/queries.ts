import { useQuery } from '@tanstack/react-query';
import { GITHUB_RELEASES_PATH } from 'domains/release/constants';
import { getChangelog } from 'domains/release/requests';
import { createApi } from 'utils/api';

const github = createApi({ baseUrl: 'https://api.github.com', timeoutMs: 10_000 });

export function useChangelog() {
  return useQuery({
    queryKey: [GITHUB_RELEASES_PATH],
    queryFn: () => getChangelog(github),
    staleTime: Infinity,
  });
}
