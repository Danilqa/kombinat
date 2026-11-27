import { useQuery } from '@tanstack/react-query';
import { getAgents } from 'domains/agent/requests';
import { api } from '@web-app/api';
import { AGENTS_QUERY_KEY } from '@web-app/query-keys';

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => getAgents(api),
  });
}
