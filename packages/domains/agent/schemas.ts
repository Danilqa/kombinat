import { z } from 'zod';

export const agentNameSchema = z.enum(['claude', 'codex', 'command']);
