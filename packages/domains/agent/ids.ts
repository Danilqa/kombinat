import { z } from 'zod';

export const sessionIdSchema = z.string().brand<'SessionId'>();

export type SessionId = z.infer<typeof sessionIdSchema>;
