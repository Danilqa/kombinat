import type { z } from 'zod';

import type { agentNameSchema, agentOptionSchema } from './schemas';

export type AgentName = z.infer<typeof agentNameSchema>;
export type AgentOption = z.infer<typeof agentOptionSchema>;
