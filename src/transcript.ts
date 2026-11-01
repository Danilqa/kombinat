import { z } from 'zod';

import type { HookItem } from './shared/contract';

export const beforeHookEventSchema = z.object({
  type: z.literal('before_hook'),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
});
export type BeforeHookEvent = z.infer<typeof beforeHookEventSchema>;

export const outputEventSchema = z.object({ type: z.literal('output'), text: z.string() });
export type OutputEvent = z.infer<typeof outputEventSchema>;

const PREVIEW_LENGTH = 160;

export function toPreview(value: string): string {
  const firstLine = value.split('\n')[0] ?? '';
  return firstLine.length > PREVIEW_LENGTH
    ? `${firstLine.slice(0, PREVIEW_LENGTH - 1)}…`
    : firstLine;
}

export function toHookItem(event: BeforeHookEvent, index: number): HookItem {
  return {
    kind: 'hook',
    key: `hook-${index}`,
    command: event.command,
    exitCode: event.exitCode,
    output: event.output,
  };
}
