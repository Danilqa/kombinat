import { z } from 'zod';

export const errorBodySchema = z.object({ error: z.string() });

export async function readResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = errorBodySchema.safeParse(body);
    throw new Error(error.success ? error.data.error : `${response.status} ${response.statusText}`);
  }
  return schema.parse(body);
}
