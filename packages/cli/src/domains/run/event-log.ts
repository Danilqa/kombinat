import fs from 'node:fs';

import { z } from 'zod';

import { runRetrySchema, usageLimitWaitSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';
import {
  messageSourceSchema,
  retryEndSchema,
  usageLimitEndSchema,
} from 'domains/transcript/schemas';

import { parseJson } from '../../utils/json';

export const hookEventSchema = z.object({
  type: z.enum(['check', 'before_hook', 'after_hook']),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
});
export type HookEvent = z.infer<typeof hookEventSchema>;

export const messageEventSchema = z.object({
  type: z.literal('message'),
  text: z.string(),
  // Messages logged before webhooks could send them have no source.
  source: messageSourceSchema.default('dashboard'),
  allowedTools: z.array(z.string()).optional(),
});

export const replyErrorEventSchema = z.object({
  type: z.literal('reply_error'),
  error: z.string(),
});

export const usageLimitWaitEventSchema = usageLimitWaitSchema.extend({
  type: z.literal('usage_limit_wait'),
});

export const usageLimitEndEventSchema = usageLimitEndSchema.extend({
  type: z.literal('usage_limit_end'),
});

export const retryWaitEventSchema = runRetrySchema.extend({ type: z.literal('retry_wait') });

export const retryEndEventSchema = retryEndSchema.extend({ type: z.literal('retry_end') });

type MessageEvent = z.infer<typeof messageEventSchema>;

export type ChatMessage = Omit<MessageEvent, 'type'>;

type ChatEvent = MessageEvent | z.infer<typeof replyErrorEventSchema>;

type UsageLimitEvent =
  z.infer<typeof usageLimitWaitEventSchema> | z.infer<typeof usageLimitEndEventSchema>;

type RetryEvent = z.infer<typeof retryWaitEventSchema> | z.infer<typeof retryEndEventSchema>;

export function readRunEvents(record: Pick<RunRecord, 'logFile'>, fromByte = 0): unknown[] {
  if (!fs.existsSync(record.logFile)) return [];
  return fs
    .readFileSync(record.logFile)
    .subarray(fromByte)
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map(parseJson)
    .filter(event => event !== undefined);
}

export function toReplyMessage({ text, source, allowedTools }: MessageEvent): ChatMessage {
  return allowedTools === undefined ? { text, source } : { text, source, allowedTools };
}

export function appendLogEvent(
  record: RunRecord,
  event: ChatEvent | UsageLimitEvent | RetryEvent,
): void {
  fs.appendFileSync(record.logFile, `${JSON.stringify(event)}\n`);
}

export function readLastMessage(record: RunRecord): ChatMessage | null {
  for (const event of readRunEvents(record).reverse()) {
    const message = messageEventSchema.safeParse(event);
    if (message.success) return toReplyMessage(message.data);
  }
  return null;
}
