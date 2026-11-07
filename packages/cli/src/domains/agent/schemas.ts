import { z } from 'zod';

export const outputEventSchema = z.object({ type: z.literal('output'), text: z.string() });
export type OutputEvent = z.infer<typeof outputEventSchema>;
