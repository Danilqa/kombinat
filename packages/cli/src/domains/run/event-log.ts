import fs from 'node:fs';

import { isMatching, match } from 'ts-pattern';
import { z } from 'zod';

import type { AgentName } from 'domains/agent/types';
import { usageLimitWaitSchema } from 'domains/run/schemas';
import type { RunRecord } from 'domains/run/types';
import { messageSourceSchema, usageLimitEndSchema } from 'domains/transcript/schemas';
import type {
  HookItem,
  HookPhase,
  Transcript,
  TranscriptItem,
  UsageLimitItem,
} from 'domains/transcript/types';

import { parseJson } from '../../utils/json';
import { getAgent } from '../agent/registry';
import { splitMemoryBlock } from '../routine/memory';

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
  allowedTools: z.array(z.string()).optional(),
});

const replyErrorEventSchema = z.object({ type: z.literal('reply_error'), error: z.string() });

const usageLimitWaitEventSchema = usageLimitWaitSchema.extend({
  type: z.literal('usage_limit_wait'),
});

const usageLimitEndEventSchema = usageLimitEndSchema.extend({
  type: z.literal('usage_limit_end'),
});

type MessageEvent = z.infer<typeof messageEventSchema>;

export type ChatMessage = Omit<MessageEvent, 'type'>;

type ChatEvent = MessageEvent | z.infer<typeof replyErrorEventSchema>;

type UsageLimitEvent =
  z.infer<typeof usageLimitWaitEventSchema> | z.infer<typeof usageLimitEndEventSchema>;

interface Reply {
  message: ChatMessage;
  events: unknown[];
  error: string | null;
}

// The agent's events up to a usage limit, or up to the end, and the wait that followed them.
interface Session {
  events: unknown[];
  wait: UsageLimitItem | null;
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

function toReplyMessage({ text, source, allowedTools }: MessageEvent): ChatMessage {
  return allowedTools === undefined ? { text, source } : { text, source, allowedTools };
}

export function appendLogEvent(record: RunRecord, event: ChatEvent | UsageLimitEvent): void {
  fs.appendFileSync(record.logFile, `${JSON.stringify(event)}\n`);
}

export function readLastMessage(record: RunRecord): ChatMessage | null {
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

// A session continued after a usage limit is its own agent process, like a reply. The pause takes
// the place of the result that the limit cut short.
function toSessionItems(agent: AgentName, session: Session, index: number): TranscriptItem[] {
  const items = getAgent(agent).buildTranscript(session.events);
  const continued =
    index === 0
      ? items
      : items
          .filter(item => !isMatching({ kind: 'init' }, item))
          .map(item => ({ ...item, key: `resume-${index}-${item.key}` }));
  if (session.wait === null) return continued;
  return [...continued.filter(item => !isMatching({ kind: 'result' }, item)), session.wait];
}

// Kombinat saves the notes at the end of the agent's message, so the message shows without them.
function withoutMemoryBlock(item: TranscriptItem): TranscriptItem[] {
  return match(item)
    .with({ kind: 'result' }, result => [{ ...result, text: splitMemoryBlock(result.text).text }])
    .with({ kind: 'text' }, text => {
      const rest = splitMemoryBlock(text.text).text;
      return rest === '' ? [] : [{ ...text, text: rest }];
    })
    .otherwise(() => [item]);
}

export function buildRunTranscript(agent: AgentName, events: unknown[]): Transcript {
  const hooks: HookItem[] = [];
  let session: Session = { events: [], wait: null };
  const sessions = [session];
  const replies: Reply[] = [];
  for (const event of events) {
    const hook = hookEventSchema.safeParse(event);
    const message = messageEventSchema.safeParse(event);
    const replyError = replyErrorEventSchema.safeParse(event);
    const wait = usageLimitWaitEventSchema.safeParse(event);
    const waitEnd = usageLimitEndEventSchema.safeParse(event);
    const reply = replies.at(-1);
    const lastWait = sessions.at(-2)?.wait;
    if (hook.success) hooks.push(toHookItem(hook.data, hooks.length));
    else if (message.success) {
      replies.push({ message: toReplyMessage(message.data), events: [], error: null });
    } else if (replyError.success && reply !== undefined) reply.error = replyError.data.error;
    else if (wait.success) {
      const { limit, stoppedAt, continuesAt } = wait.data;
      const key = `usage-limit-${sessions.length - 1}`;
      session.wait = { kind: 'usage-limit', key, limit, stoppedAt, continuesAt, end: null };
      session = { events: [], wait: null };
      sessions.push(session);
    } else if (waitEnd.success && lastWait) {
      lastWait.end = { at: waitEnd.data.at, outcome: waitEnd.data.outcome };
    } else (reply?.events ?? session.events).push(event);
  }
  return {
    eventCount: events.length,
    items: [
      ...hooks.filter(isMatching({ phase: 'before' })),
      ...sessions.flatMap((session, index) => toSessionItems(agent, session, index)),
      ...hooks.filter(isMatching({ phase: 'after' })),
      ...replies.flatMap((reply, index) => toReplyItems(agent, reply, index)),
    ].flatMap(withoutMemoryBlock),
  };
}
