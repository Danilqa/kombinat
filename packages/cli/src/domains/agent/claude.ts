import { match } from 'ts-pattern';
import { z } from 'zod';

import type { ToolResult, TranscriptItem } from 'domains/transcript/types';
import { toPreview } from 'domains/transcript/utils';

import { config } from '../../config';
import { isRecord } from '../../utils/json';
import { getUnattendedNote, pickOne, rejectUnsupported, withoutEnv } from './settings';
import type { Agent, RunUpdate } from './types';

const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_EFFORT = 'high';
const DEFAULT_PERMISSION_MODE = 'auto';
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const PERMISSION_MODES = [
  'auto',
  'acceptEdits',
  'dontAsk',
  'bypassPermissions',
  'plan',
  'manual',
] as const;
// Runs use the subscription login, never an API key, and must not think they run inside Claude Code.
const DROPPED_ENV = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
];

const PREVIEW_FIELDS: Record<string, string> = {
  Bash: 'command',
  Read: 'file_path',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  Write: 'file_path',
  NotebookEdit: 'notebook_path',
  Grep: 'pattern',
  Glob: 'pattern',
  WebFetch: 'url',
  WebSearch: 'query',
  Task: 'description',
  Agent: 'description',
  Skill: 'skill',
  ToolSearch: 'query',
};

const contentBlockSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.unknown().optional(),
  tool_use_id: z.string().optional(),
  content: z.unknown().optional(),
  is_error: z.boolean().optional(),
});
type ContentBlock = z.infer<typeof contentBlockSchema>;

const textPartSchema = z.object({ type: z.literal('text'), text: z.string() });

const claudeEventSchema = z.object({
  type: z.string().optional(),
  subtype: z.string().optional(),
  session_id: z.string().optional(),
  parent_tool_use_id: z.string().nullable().optional(),
  message: z.object({ content: z.unknown().optional() }).optional(),
  model: z.string().optional(),
  cwd: z.string().optional(),
  tools: z.array(z.unknown()).optional(),
  permissionMode: z.string().optional(),
  result: z.string().optional(),
  is_error: z.boolean().optional(),
  total_cost_usd: z.number().optional(),
  num_turns: z.number().optional(),
  duration_ms: z.number().optional(),
});
type ClaudeEvent = z.infer<typeof claudeEventSchema>;

function toClaudeEvents(events: unknown[]): ClaudeEvent[] {
  return events.flatMap(event => {
    const parsed = claudeEventSchema.safeParse(event);
    return parsed.success ? [parsed.data] : [];
  });
}

function getContentBlocks(event: ClaudeEvent): ContentBlock[] {
  const content = event.message?.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap(block => {
    const parsed = contentBlockSchema.safeParse(block);
    return parsed.success ? [parsed.data] : [];
  });
}

function getInputPreview(name: string, input: unknown): string {
  const field = PREVIEW_FIELDS[name];
  const value = field !== undefined && isRecord(input) ? input[field] : undefined;
  return toPreview(typeof value === 'string' ? value : JSON.stringify(input ?? {}));
}

function stringifyResultContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content, null, 2);
  return content
    .map(part => {
      const textPart = textPartSchema.safeParse(part);
      return textPart.success ? textPart.data.text : JSON.stringify(part);
    })
    .join('\n');
}

function collectToolResults(events: ClaudeEvent[]): Map<string, ToolResult> {
  const results = new Map<string, ToolResult>();
  for (const event of events) {
    if (event.type !== 'user') continue;
    for (const block of getContentBlocks(event)) {
      if (block.type !== 'tool_result' || block.tool_use_id === undefined) continue;
      results.set(block.tool_use_id, {
        content: stringifyResultContent(block.content),
        isError: block.is_error === true,
      });
    }
  }
  return results;
}

function toBlockItems(
  block: ContentBlock,
  key: string,
  isSubagent: boolean,
  results: Map<string, ToolResult>,
): TranscriptItem[] {
  return match(block)
    .with({ type: 'text' }, ({ text }): TranscriptItem[] =>
      text?.trim() ? [{ kind: 'text', key, text, isSubagent }] : [],
    )
    .with({ type: 'tool_use' }, (tool): TranscriptItem[] => {
      const name = tool.name ?? 'tool';
      return [
        {
          kind: 'tool',
          key,
          id: tool.id ?? key,
          name,
          input: tool.input,
          preview: getInputPreview(name, tool.input),
          result: tool.id === undefined ? null : (results.get(tool.id) ?? null),
          isSubagent,
        },
      ];
    })
    .otherwise(() => []);
}

function toItems(
  event: ClaudeEvent,
  index: number,
  results: Map<string, ToolResult>,
): TranscriptItem[] {
  return match(event)
    .with({ type: 'system', subtype: 'init' }, (init): TranscriptItem[] => [
      {
        kind: 'init',
        key: `init-${index}`,
        model: init.model ?? null,
        cwd: init.cwd ?? null,
        toolCount: init.tools?.length ?? null,
        permissionMode: init.permissionMode ?? null,
      },
    ])
    .with({ type: 'assistant' }, assistant =>
      getContentBlocks(assistant).flatMap((block, blockIndex) =>
        toBlockItems(
          block,
          `${index}-${blockIndex}`,
          Boolean(assistant.parent_tool_use_id),
          results,
        ),
      ),
    )
    .with({ type: 'result' }, (result): TranscriptItem[] => [
      {
        kind: 'result',
        key: `result-${index}`,
        text: result.result ?? '',
        isError: result.is_error === true,
        costUsd: result.total_cost_usd ?? null,
        numTurns: result.num_turns ?? null,
        durationMs: result.duration_ms ?? null,
      },
    ])
    .otherwise(() => []);
}

function readResult(event: ClaudeEvent): RunUpdate {
  const update: RunUpdate = {
    resultText: event.result ?? null,
    costUsd: event.total_cost_usd ?? null,
    numTurns: event.num_turns ?? null,
    durationMs: event.duration_ms ?? null,
  };
  if (event.is_error === true) update.error = event.result ?? 'Claude reported an error result';
  return update;
}

export const claudeAgent: Agent = {
  name: 'claude',
  output: 'jsonl',
  binaryEnv: 'CLAUDE_BIN',

  resolveSettings(raw) {
    rejectUnsupported(raw, ['command'], 'claude');
    return {
      ...raw,
      model: raw.model ?? DEFAULT_MODEL,
      effort: pickOne(raw.effort, EFFORTS, 'effort', 'claude') ?? DEFAULT_EFFORT,
      permissionMode:
        pickOne(raw.permissionMode, PERMISSION_MODES, 'permissionMode', 'claude') ??
        DEFAULT_PERMISSION_MODE,
    };
  },

  buildInvocation(context) {
    const { routine } = context;
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      routine.permissionMode ?? DEFAULT_PERMISSION_MODE,
      '--permission-prompts',
      'none',
      '--model',
      routine.model ?? DEFAULT_MODEL,
      '--effort',
      routine.effort ?? DEFAULT_EFFORT,
      '--name',
      `routine/${routine.name}/${context.runId}`,
      '--append-system-prompt',
      getUnattendedNote(context),
    ];
    if (routine.maxBudgetUsd !== null) {
      args.push('--max-budget-usd', String(routine.maxBudgetUsd));
    }
    return { command: config.claudeBin, args, env: withoutEnv(DROPPED_ENV), input: routine.prompt };
  },

  readEvent(event) {
    const parsed = claudeEventSchema.safeParse(event);
    if (!parsed.success) return {};
    return match(parsed.data)
      .with({ type: 'system', subtype: 'init' }, (init): RunUpdate => {
        const update: RunUpdate = {};
        if (init.session_id !== undefined) update.sessionId = init.session_id;
        if (init.model !== undefined) update.model = init.model;
        return update;
      })
      .with({ type: 'result' }, readResult)
      .otherwise(() => ({}));
  },

  buildTranscript(events) {
    const claudeEvents = toClaudeEvents(events);
    const results = collectToolResults(claudeEvents);
    return claudeEvents.flatMap((event, index) => toItems(event, index, results));
  },

  getResumeCommand: sessionId => `claude --resume ${sessionId}`,
};
