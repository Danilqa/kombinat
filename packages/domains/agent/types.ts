import type { z } from 'zod';

import type { agentNameSchema } from './schemas';

export type AgentName = z.infer<typeof agentNameSchema>;
