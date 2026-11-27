import type { Api } from 'utils/api';

import { agentOptionsSchema } from './schemas';
import type { AgentOption } from './types';

export async function getAgents(api: Api): Promise<AgentOption[]> {
  return api.get('/api/agents').json(agentOptionsSchema);
}
