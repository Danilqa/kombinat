import { isMatching, match } from 'ts-pattern';

import type { AgentName } from 'domains/agent/types';
import type {
  HookItem,
  HookPhase,
  RetryItem,
  Transcript,
  TranscriptItem,
  UsageLimitItem,
} from 'domains/transcript/types';

import { checkIsRecord } from '../../utils/json';
import { getAgent } from '../agent/registry';
import { splitMemoryBlock } from '../routine/memory';
import {
  hookEventSchema,
  messageEventSchema,
  replyErrorEventSchema,
  retryEndEventSchema,
  retryWaitEventSchema,
  toReplyMessage,
  usageLimitEndEventSchema,
  usageLimitWaitEventSchema,
} from './event-log';
import type { ChatMessage, HookEvent } from './event-log';

interface Reply {
  message: ChatMessage;
  events: unknown[];
  error: string | null;
}

// The agent's events up to a usage limit, an error that is retried or the end, and the wait that
// followed them. An attempt that starts over runs the before hook again.
interface Session {
  hooks: HookItem[];
  events: unknown[];
  wait: UsageLimitItem | RetryItem | null;
}

function toHookItem(event: HookEvent, index: number): HookItem {
  return {
    kind: 'hook',
    key: `hook-${index}`,
    command: event.command,
    exitCode: event.exitCode,
    output: event.output,
    phase: match(event.type)
      .with('check', (): HookPhase => 'check')
      .with('before_hook', (): HookPhase => 'before')
      .with('after_hook', (): HookPhase => 'after')
      .exhaustive(),
  };
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

// A session continued after a usage limit or an error is its own agent process, like a reply. The
// pause takes the place of the result that it cut short.
function toSessionItems(
  agent: AgentName,
  session: Session,
  index: number,
  previous: Session | undefined,
): TranscriptItem[] {
  const items = getAgent(agent).buildTranscript(session.events);
  const isStartedOver = isMatching({ kind: 'retry', continuesSession: false }, previous?.wait);
  const continued =
    index === 0
      ? items
      : items
          .filter(item => isStartedOver || !isMatching({ kind: 'init' }, item))
          .map(item => ({ ...item, key: `resume-${index}-${item.key}` }));
  const withHooks = [...session.hooks, ...continued];
  if (session.wait === null) return withHooks;
  return [...withHooks.filter(item => !isMatching({ kind: 'result' }, item)), session.wait];
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
  let hookCount = 0;
  const checkHooks: HookItem[] = [];
  const afterHooks: HookItem[] = [];
  let session: Session = { hooks: [], events: [], wait: null };
  const sessions = [session];
  const replies: Reply[] = [];
  for (const event of events) {
    const hook = hookEventSchema.safeParse(event);
    const message = messageEventSchema.safeParse(event);
    const replyError = replyErrorEventSchema.safeParse(event);
    const wait = usageLimitWaitEventSchema.safeParse(event);
    const waitEnd = usageLimitEndEventSchema.safeParse(event);
    // Agents log thousands of events, so these rare ones are parsed only when the type says so.
    const type = checkIsRecord(event) ? event['type'] : null;
    const retryWait = type === 'retry_wait' ? retryWaitEventSchema.safeParse(event) : null;
    const retryEnd = type === 'retry_end' ? retryEndEventSchema.safeParse(event) : null;
    const reply = replies.at(-1);
    const lastWait = sessions.at(-2)?.wait;
    if (hook.success) {
      const item = toHookItem(hook.data, hookCount);
      hookCount += 1;
      match(item.phase)
        .with('check', () => checkHooks.push(item))
        .with('before', () => session.hooks.push(item))
        .with('after', () => afterHooks.push(item))
        .exhaustive();
    } else if (message.success) {
      replies.push({ message: toReplyMessage(message.data), events: [], error: null });
    } else if (replyError.success && reply !== undefined) reply.error = replyError.data.error;
    else if (wait.success) {
      const { limit, stoppedAt, continuesAt } = wait.data;
      const key = `usage-limit-${sessions.length - 1}`;
      session.wait = { kind: 'usage-limit', key, limit, stoppedAt, continuesAt, end: null };
      session = { hooks: [], events: [], wait: null };
      sessions.push(session);
    } else if (retryWait?.success) {
      const { attempt, attempts, error, stoppedAt, continuesAt, continuesSession } = retryWait.data;
      session.wait = {
        kind: 'retry',
        key: `retry-${sessions.length - 1}`,
        attempt,
        attempts,
        error,
        stoppedAt,
        continuesAt,
        continuesSession,
        end: null,
      };
      session = { hooks: [], events: [], wait: null };
      sessions.push(session);
    } else if (waitEnd.success && isMatching({ kind: 'usage-limit' }, lastWait)) {
      lastWait.end = { at: waitEnd.data.at, outcome: waitEnd.data.outcome };
    } else if (retryEnd?.success && isMatching({ kind: 'retry' }, lastWait)) {
      lastWait.end = { at: retryEnd.data.at, outcome: retryEnd.data.outcome };
    } else (reply?.events ?? session.events).push(event);
  }
  return {
    eventCount: events.length,
    items: [
      ...checkHooks,
      ...sessions.flatMap((session, index) =>
        toSessionItems(agent, session, index, sessions[index - 1]),
      ),
      ...afterHooks,
      ...replies.flatMap((reply, index) => toReplyItems(agent, reply, index)),
    ].flatMap(withoutMemoryBlock),
  };
}
