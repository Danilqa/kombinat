import { match, P } from 'ts-pattern';
import { z } from 'zod';

import type { ToolResult, TranscriptItem } from 'domains/transcript/types';
import { toPreview } from 'domains/transcript/utils';

import { config } from '../../config';
import { getUnattendedNote, pickOne, rejectUnsupported, withoutEnv } from './settings';
import type { Agent, RunUpdate } from './types';

const DEFAULT_SANDBOX = 'workspace-write';
const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;
const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const;
// Runs use the ChatGPT login, never an API key.
const DROPPED_ENV = ['OPENAI_API_KEY', 'CODEX_API_KEY'];

const codexErrorSchema = z.object({ message: z.string().optional() });

const codexItemSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  text: z.string().optional(),
  command: z.string().optional(),
  aggregated_output: z.string().optional(),
  exit_code: z.number().nullable().optional(),
  status: z.string().optional(),
  changes: z
    .array(z.object({ path: z.string().optional(), kind: z.string().optional() }))
    .optional(),
  server: z.string().optional(),
  tool: z.string().optional(),
  arguments: z.unknown().optional(),
  result: z.unknown().optional(),
  error: codexErrorSchema.nullable().optional(),
  query: z.string().optional(),
  items: z
    .array(z.object({ text: z.string().optional(), completed: z.boolean().optional() }))
    .optional(),
  message: z.string().optional(),
});
type CodexItem = z.infer<typeof codexItemSchema>;
type TodoEntry = NonNullable<CodexItem['items']>[number];

const codexEventSchema = z.object({
  type: z.string().optional(),
  thread_id: z.string().optional(),
  item: codexItemSchema.optional(),
  error: codexErrorSchema.optional(),
  message: z.string().optional(),
});
type CodexEvent = z.infer<typeof codexEventSchema>;

const mcpResultSchema = z.object({ content: z.array(z.unknown()) });
const textPartSchema = z.object({ text: z.string() });

function toCodexEvents(events: unknown[]): CodexEvent[] {
  return events.flatMap(event => {
    const parsed = codexEventSchema.safeParse(event);
    return parsed.success ? [parsed.data] : [];
  });
}

function stringifyMcpResult(result: unknown): string {
  const parsed = mcpResultSchema.safeParse(result);
  if (!parsed.success) return JSON.stringify(result ?? null, null, 2);
  return parsed.data.content
    .map(part => {
      const textPart = textPartSchema.safeParse(part);
      return textPart.success ? textPart.data.text : JSON.stringify(part);
    })
    .join('\n');
}

function getCommandResult(item: CodexItem): ToolResult | null {
  if (item.status === 'in_progress') return null;
  const isError =
    item.status === 'failed' ||
    item.status === 'declined' ||
    (item.exit_code !== undefined && item.exit_code !== null && item.exit_code !== 0);
  return { content: item.aggregated_output ?? '', isError };
}

function getMcpResult(item: CodexItem): ToolResult | null {
  if (item.status === 'in_progress') return null;
  if (item.error?.message !== undefined) return { content: item.error.message, isError: true };
  return { content: stringifyMcpResult(item.result), isError: item.status === 'failed' };
}

function getStatusResult(item: CodexItem): ToolResult | null {
  return match(item.status)
    .with('in_progress', () => null)
    .with('failed', () => ({ content: 'failed', isError: true }))
    .otherwise(status => ({ content: status ?? '', isError: false }));
}

function toTool(
  key: string,
  name: string,
  input: unknown,
  preview: string,
  result: ToolResult | null,
): TranscriptItem {
  return { kind: 'tool', key, id: key, name, input, preview, result, isSubagent: false };
}

function toTodoMarkdown(entries: TodoEntry[]): string {
  return entries
    .map(entry => `- [${entry.completed === true ? 'x' : ' '}] ${entry.text ?? ''}`)
    .join('\n');
}

function toItem(item: CodexItem, index: number): TranscriptItem | null {
  const key = `item-${item.id ?? index}`;
  return match(item)
    .with({ type: 'agent_message' }, ({ text }): TranscriptItem | null =>
      text?.trim() ? { kind: 'text', key, text, isSubagent: false } : null,
    )
    .with({ type: 'command_execution' }, command =>
      toTool(
        key,
        'Shell',
        { command: command.command },
        toPreview(command.command ?? ''),
        getCommandResult(command),
      ),
    )
    .with({ type: 'file_change' }, change => {
      const changes = change.changes ?? [];
      const preview = changes.map(file => `${file.kind ?? 'update'} ${file.path ?? ''}`).join(', ');
      return toTool(key, 'Edit', { changes }, toPreview(preview), getStatusResult(change));
    })
    .with({ type: 'mcp_tool_call' }, call =>
      toTool(
        key,
        `${call.server ?? 'mcp'}.${call.tool ?? 'tool'}`,
        call.arguments,
        toPreview(JSON.stringify(call.arguments ?? {})),
        getMcpResult(call),
      ),
    )
    .with({ type: 'web_search' }, search =>
      toTool(
        key,
        'WebSearch',
        { query: search.query },
        toPreview(search.query ?? ''),
        getStatusResult(search),
      ),
    )
    .with({ type: 'todo_list' }, ({ items }): TranscriptItem => ({
      kind: 'text',
      key,
      text: toTodoMarkdown(items ?? []),
      isSubagent: false,
    }))
    .with({ type: 'error' }, ({ message }): TranscriptItem => ({
      kind: 'text',
      key,
      text: `**Error:** ${message ?? 'unknown error'}`,
      isSubagent: false,
    }))
    .otherwise(() => null);
}

function toResult(index: number, numTurns: number, error: string | null): TranscriptItem {
  return {
    kind: 'result',
    key: `result-${index}`,
    text: error ?? '',
    isError: error !== null,
    costUsd: null,
    numTurns,
    durationMs: null,
  };
}

export const codexAgent: Agent = {
  name: 'codex',
  output: 'jsonl',
  binaryEnv: 'CODEX_BIN',

  resolveSettings(raw) {
    rejectUnsupported(raw, ['command', 'maxBudgetUsd'], 'codex');
    return {
      ...raw,
      effort: pickOne(raw.effort, EFFORTS, 'effort', 'codex'),
      permissionMode:
        pickOne(raw.permissionMode, SANDBOX_MODES, 'permissionMode', 'codex') ?? DEFAULT_SANDBOX,
    };
  },

  buildInvocation(context) {
    const { routine } = context;
    const args = [
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--sandbox',
      routine.permissionMode ?? DEFAULT_SANDBOX,
    ];
    if (routine.model !== null) args.push('--model', routine.model);
    if (routine.effort !== null) {
      args.push('--config', `model_reasoning_effort="${routine.effort}"`);
    }
    args.push('-');
    return {
      command: config.codexBin,
      args,
      env: withoutEnv(DROPPED_ENV),
      input: `${getUnattendedNote(context)}\n\n${routine.prompt}`,
    };
  },

  readEvent(event, record) {
    const parsed = codexEventSchema.safeParse(event);
    if (!parsed.success) return {};
    return match(parsed.data)
      .with({ type: 'thread.started', thread_id: P.string }, ({ thread_id }): RunUpdate => ({
        sessionId: thread_id,
      }))
      .with(
        { type: 'item.completed', item: { type: 'agent_message', text: P.string } },
        ({ item }): RunUpdate => ({ resultText: item.text }),
      )
      .with({ type: 'turn.completed' }, (): RunUpdate => ({ numTurns: (record.numTurns ?? 0) + 1 }))
      .with({ type: 'turn.failed' }, ({ error }): RunUpdate => ({
        error: error?.message ?? 'Codex reported a failed turn',
      }))
      .otherwise(() => ({}));
  },

  buildTranscript(events) {
    const items: TranscriptItem[] = [];
    const positions = new Map<string, number>();
    let turns = 0;
    const upsert = (item: TranscriptItem | null): void => {
      if (item === null) return;
      const position = positions.get(item.key);
      if (position === undefined) {
        positions.set(item.key, items.length);
        items.push(item);
      } else {
        items[position] = item;
      }
    };

    toCodexEvents(events).forEach((event, index) => {
      if (event.type === 'turn.completed') turns += 1;
      upsert(
        match(event)
          .with({ type: 'thread.started' }, (): TranscriptItem => ({
            kind: 'init',
            key: `init-${index}`,
            model: null,
            cwd: null,
            toolCount: null,
            permissionMode: null,
          }))
          .with({ type: P.union('item.started', 'item.updated', 'item.completed') }, ({ item }) =>
            item === undefined ? null : toItem(item, index),
          )
          .with({ type: 'turn.completed' }, () => toResult(index, turns, null))
          .with({ type: 'turn.failed' }, ({ error }) =>
            toResult(index, turns, error?.message ?? 'turn failed'),
          )
          .with({ type: 'error' }, ({ message }): TranscriptItem => ({
            kind: 'text',
            key: `error-${index}`,
            text: `**Error:** ${message ?? 'unknown error'}`,
            isSubagent: false,
          }))
          .otherwise(() => null),
      );
    });
    return items;
  },

  getResumeCommand: sessionId => `codex resume ${sessionId}`,
};
