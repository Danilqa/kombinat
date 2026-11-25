import { z } from 'zod';

export const agentNameSchema = z.enum(['claude', 'codex', 'command']);

// An agent that takes a prompt, with what this machine has for it. The models are suggestions: the agent may accept others.
export const agentOptionSchema = z.object({
  name: agentNameSchema.exclude(['command']),
  isInstalled: z.boolean(),
  models: z.array(z.string()),
});

export const agentOptionsSchema = z.array(agentOptionSchema);
