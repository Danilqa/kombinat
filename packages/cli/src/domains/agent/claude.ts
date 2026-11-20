import { match, P } from 'ts-pattern';
import { z } from 'zod';

import { sessionIdSchema } from 'domains/agent/ids';
import type { PlanLimits, UsageLimit } from 'domains/daemon/types';
import type { TokenCounts } from 'domains/run/types';
import { addTokenCounts } from 'domains/run/utils';
import type { ToolResult, TranscriptItem, UsageLimitKind } from 'domains/transcript/types';
import { toPreview } from 'domains/transcript/utils';

import { config } from '../../config';
import { checkIsRecord } from '../../utils/json';
import {
  getReplyNote,
  getUnattendedNote,
  pickOne,
  rejectUnsupported,
  splitModels,
  withoutEnv,
} from './settings';
import type { Agent, RunContext, RunUpdate } from './types';

const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_EFFORT = 'high';
const DEFAULT_PERMISSION_MODE = 'auto';
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const USAGE_LIMIT_POLICIES = ['wait', 'fail'] as const;
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

const usageWindowSchema = z.object({ utilization: z.number(), resetsAt: z.number() });
type UsageWindow = z.infer<typeof usageWindowSchema>;

const rateLimitInfoSchema = z.object({
  status: z.string().optional(),
  resetsAt: z.number().optional(),
  rateLimitType: z.string().optional(),
  unifiedWindows: z
    .object({
      five_hour: usageWindowSchema.optional(),
      seven_day: usageWindowSchema.optional(),
    })
    .optional(),
});

const resultUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
});

const modelUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cacheCreationInputTokens: z.number().optional(),
  cacheReadInputTokens: z.number().optional(),
});

const claudeEventSchema = z.object({
  type: z.string().optional(),
  subtype: z.string().optional(),
  session_id: sessionIdSchema.optional(),
  parent_tool_use_id: z.string().nullable().optional(),
  message: z.object({ content: z.unknown().optional() }).optional(),
  model: z.string().optional(),
  trigger: z.string().optional(),
  original_model: z.string().optional(),
  fallback_model: z.string().optional(),
  cwd: z.string().optional(),
  tools: z.array(z.unknown()).optional(),
  permissionMode: z.string().optional(),
  result: z.string().optional(),
  is_error: z.boolean().optional(),
  total_cost_usd: z.number().optional(),
  num_turns: z.number().optional(),
  duration_ms: z.number().optional(),
  rate_limit_info: rateLimitInfoSchema.optional(),
  error: z.string().optional(),
  usage: resultUsageSchema.optional(),
  modelUsage: z.record(z.string(), modelUsageSchema).optional(),
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
  const value = field !== undefined && checkIsRecord(input) ? input[field] : undefined;
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
    .with(
      { type: 'system', subtype: 'model_fallback', fallback_model: P.string },
      (fallback): TranscriptItem[] => [
        {
          kind: 'model-fallback',
          key: `fallback-${index}`,
          from: fallback.original_model ?? '?',
          to: fallback.fallback_model,
          reason: fallback.trigger ?? null,
        },
      ],
    )
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

// modelUsage counts every model of the session, subagents included. usage counts only the main one.
function readTokens({ usage, modelUsage }: ClaudeEvent): TokenCounts | null {
  const models = Object.values(modelUsage ?? {});
  if (models.length > 0) {
    return models
      .map((model): TokenCounts => ({
        input: model.inputTokens ?? 0,
        output: model.outputTokens ?? 0,
        cacheWrite: model.cacheCreationInputTokens ?? 0,
        cacheRead: model.cacheReadInputTokens ?? 0,
      }))
      .reduce((sum, counts) => addTokenCounts(sum, counts) ?? counts);
  }
  if (usage === undefined) return null;
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
  };
}

function readResult(event: ClaudeEvent): RunUpdate {
  const update: RunUpdate = {
    resultText: event.result ?? null,
    costUsd: event.total_cost_usd ?? null,
    numTurns: event.num_turns ?? null,
    durationMs: event.duration_ms ?? null,
    tokens: readTokens(event),
  };
  if (event.is_error === true) update.error = event.result ?? 'Claude reported an error result';
  return update;
}

function toUsageLimit(window: UsageWindow | undefined): UsageLimit | null {
  if (window === undefined) return null;
  return {
    usedRatio: window.utilization,
    resetsAt: new Date(window.resetsAt * 1000).toISOString(),
  };
}

function toUsageLimitKind(rateLimitType: string | undefined): UsageLimitKind {
  return match(rateLimitType)
    .with('five_hour', (): UsageLimitKind => 'session')
    .with(P.string.startsWith('seven_day'), (): UsageLimitKind => 'week')
    .otherwise(() => 'other');
}

function buildArgs(context: RunContext, note: string): string[] {
  const { routine } = context;
  const fallbackModels = splitModels(routine.fallbackModel);
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
    note,
  ];
  if (fallbackModels.length > 0) args.push('--fallback-model', fallbackModels.join(','));
  if (routine.maxBudgetUsd !== null) args.push('--max-budget-usd', String(routine.maxBudgetUsd));
  return args;
}

export const claudeAgent: Agent = {
  name: 'claude',
  output: 'jsonl',
  binaryEnv: 'CLAUDE_BIN',

  resolveSettings(raw) {
    rejectUnsupported(raw, ['command'], 'claude');
    const fallbackModels = splitModels(raw.fallbackModel);
    return {
      ...raw,
      model: raw.model ?? DEFAULT_MODEL,
      fallbackModel: fallbackModels.length === 0 ? null : fallbackModels.join(', '),
      effort: pickOne(raw.effort, EFFORTS, 'effort', 'claude') ?? DEFAULT_EFFORT,
      permissionMode:
        pickOne(raw.permissionMode, PERMISSION_MODES, 'permissionMode', 'claude') ??
        DEFAULT_PERMISSION_MODE,
      onUsageLimit:
        pickOne(raw.onUsageLimit, USAGE_LIMIT_POLICIES, 'onUsageLimit', 'claude') ?? 'wait',
    };
  },

  buildInvocation(context) {
    return {
      command: config.claudeBin,
      args: buildArgs(context, getUnattendedNote(context)),
      env: withoutEnv(DROPPED_ENV),
      input: context.routine.prompt,
    };
  },

  buildReplyInvocation(context, sessionId, message) {
    return {
      command: config.claudeBin,
      args: [...buildArgs(context, getReplyNote(context, message.source)), '--resume', sessionId],
      env: withoutEnv(DROPPED_ENV),
      input: message.text,
    };
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
      .with(
        { type: 'system', subtype: 'model_fallback', fallback_model: P.string },
        ({ fallback_model }): RunUpdate => ({ model: fallback_model }),
      )
      .with({ type: 'result' }, readResult)
      .otherwise(() => ({}));
  },

  readPlanLimits(event) {
    const parsed = claudeEventSchema.safeParse(event);
    if (!parsed.success || parsed.data.type !== 'rate_limit_event') return null;
    const windows = parsed.data.rate_limit_info?.unifiedWindows;
    const limits: PlanLimits = {
      session: toUsageLimit(windows?.five_hour),
      week: toUsageLimit(windows?.seven_day),
    };
    return limits.session === null && limits.week === null ? null : limits;
  },

  // A turn cut short by a limit ends with a synthetic message marked rate_limit. The reset comes
  // from the latest rate limit event, which says rejected once the plan has no usage left.
  findUsageLimitStop(events) {
    const claudeEvents = toClaudeEvents(events);
    const lastMessage = claudeEvents.findLast(event => event.type === 'assistant');
    const info = claudeEvents.findLast(event => event.type === 'rate_limit_event')?.rate_limit_info;
    if (lastMessage?.error !== 'rate_limit' || info?.status !== 'rejected') return null;
    if (info.resetsAt === undefined) return null;
    return {
      limit: toUsageLimitKind(info.rateLimitType),
      resetsAt: new Date(info.resetsAt * 1000).toISOString(),
    };
  },

  buildTranscript(events) {
    const claudeEvents = toClaudeEvents(events);
    const results = collectToolResults(claudeEvents);
    return claudeEvents.flatMap((event, index) => toItems(event, index, results));
  },

  getResumeCommand: sessionId => `claude --resume ${sessionId}`,
};
