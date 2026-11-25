import { z } from 'zod';

export const sessionIdSchema = z.string().brand<'SessionId'>();

export type SessionId = z.infer<typeof sessionIdSchema>;

// The login a routine runs on, which keeps its own plan and limits. The name is safe in a folder
// name and a shell word, such as work or me@example.com.
export const accountNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][\w.@+-]{0,63}$/)
  .brand<'AccountName'>();

export type AccountName = z.infer<typeof accountNameSchema>;

// The machine's own login, which a routine without an account runs on. It is null in records.
export const PRIMARY_ACCOUNT = 'primary';
