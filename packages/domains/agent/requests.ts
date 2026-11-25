import type { HttpClient } from 'utils/http';

import { agentOptionsSchema } from './schemas';
import type { AgentOption } from './types';

export async function getAgents(http: HttpClient): Promise<AgentOption[]> {
  return http.request('/api/agents', agentOptionsSchema);
}
