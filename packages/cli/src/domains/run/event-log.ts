import fs from 'node:fs';

import { isMatching, match } from 'ts-pattern';
import { z } from 'zod';

import type { AgentName } from 'domains/agent/types';
import type { RunRecord } from 'domains/run/types';
import { messageSourceSchema } from 'domains/transcript/schemas';
import type { HookItem, HookPhase, Transcript, TranscriptItem } from 'domains/transcript/types';

import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';
import type { ReplyMessage } from '../agent/types';

const hookEventSchema = z.object({
  type: z.enum(['before_hook', 'after_hook']),
  command: z.string(),
  exitCode: z.number().nullable(),
  output: z.string(),
});
export type HookEvent = z.infer<typeof hookEventSchema>;

const messageEventSchema = z.object({
  type: z.literal('message'),
  text: z.string(),
  // Messages logged before webhooks could send them have no source.
  source: messageSourceSchema.default('dashboard'),
});

const replyErrorEventSchema = z.object({ type: z.literal('reply_error'), error: z.string() });

type MessageEvent = z.infer<typeof messageEventSchema>;

type ChatEvent = MessageEvent | z.infer<typeof replyErrorEventSchema>;

interface Reply {
  message: ReplyMessage;
  events: unknown[];
  error: string | null;
}

function toHookItem(event: HookEvent, index: number): HookItem {
  return {
    kind: 'hook',
    key: `hook-${index}`,
    command: event.command,
    exitCode: event.exitCode,
    output: event.output,
    phase: match(event.type)
      .with('before_hook', (): HookPhase => 'before')
      .with('after_hook', (): HookPhase => 'after')
      .exhaustive(),
  };
}

export function readRunEvents(record: RunRecord): unknown[] {
  if (!fs.existsSync(record.logFile)) return [];
  return fs
    .readFileSync(record.logFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(parseJson)
    .filter(event => event !== undefined);
}

function toReplyMessage({ text, source }: MessageEvent): ReplyMessage {
  return { text, source };
}

export function appendChatEvent(record: RunRecord, event: ChatEvent): void {
  fs.appendFileSync(record.logFile, `${JSON.stringify(event)}\n`);
}

export function readLastMessage(record: RunRecord): ReplyMessage | null {
  for (const event of readRunEvents(record).reverse()) {
    const message = messageEventSchema.safeParse(event);
    if (message.success) return toReplyMessage(message.data);
  }
  return null;
}

// Each reply is its own agent process, so its events become items apart from the run's.
function toReplyItems(agent: AgentName, reply: Reply, index: number): TranscriptItem[] {
  const key = `reply-${index}`;
  const items = getAgent(agent)
    .buildTranscript(reply.events)
    .filter(item => !isMatching({ kind: 'init' }, item))
    .map(item => ({ ...item, key: `${key}-${item.key}` }));
  const error: TranscriptItem[] =
    reply.error === null
      ? []
      : [
          {
            kind: 'text',
            key: `${key}-error`,
            text: `**Error:** ${reply.error}`,
            isSubagent: false,
          },
        ];
  return [{ kind: 'message', key, ...reply.message }, ...items, ...error];
}

export function buildRunTranscript(agent: AgentName, events: unknown[]): Transcript {
  const hooks: HookItem[] = [];
  const agentEvents: unknown[] = [];
  const replies: Reply[] = [];
  for (const event of events) {
    const hook = hookEventSchema.safeParse(event);
    const message = messageEventSchema.safeParse(event);
    const replyError = replyErrorEventSchema.safeParse(event);
    const reply = replies.at(-1);
    if (hook.success) hooks.push(toHookItem(hook.data, hooks.length));
    else if (message.success) {
      replies.push({ message: toReplyMessage(message.data), events: [], error: null });
    } else if (replyError.success && reply !== undefined) reply.error = replyError.data.error;
    else (reply?.events ?? agentEvents).push(event);
  }
  return {
    eventCount: events.length,
    items: [
      ...hooks.filter(isMatching({ phase: 'before' })),
      ...getAgent(agent).buildTranscript(agentEvents),
      ...hooks.filter(isMatching({ phase: 'after' })),
      ...replies.flatMap((reply, index) => toReplyItems(agent, reply, index)),
    ],
  };
}
