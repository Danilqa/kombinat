import { ChevronRight, CircleAlert, CircleCheck, Loader, X } from 'lucide-react';
import { memo, useState } from 'react';
import { match } from 'ts-pattern';

import { CodeBlock, Collapsible, EmptyState, Markdown } from 'design-system/components';
import { cn } from 'design-system/utils';
import { formatDuration } from 'utils/date-time';

import type {
  HookItem,
  InitItem,
  MessageItem,
  ModelFallbackItem,
  ResultItem,
  TextItem,
  ToolItem,
  TranscriptItem,
} from '../types';
import {
  checkHasToolSearchMatch,
  checkIsSubagent,
  formatToolInput,
  getHookLabel,
  getMessageSourceLabel,
  getModelFallbackReasonLabel,
  getTranscriptEmptyLabel,
  getTranscriptResultLabel,
  getTurnsLabel,
} from '../utils';

interface HookRowProps {
  item: HookItem;
}

function HookRow({ item }: HookRowProps) {
  return (
    <div className="space-y-2 text-body-sm text-fg-muted">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body font-medium text-fg">{getHookLabel(item.phase)}</span>
        <span className="min-w-0 font-mono wrap-anywhere">{item.command}</span>
        <span className={cn('font-mono tabular-nums', item.exitCode !== 0 && 'text-negative')}>
          exit {item.exitCode ?? '?'}
        </span>
      </div>
      {item.output && (
        <CodeBlock label="Hook output" className="max-h-60">
          {item.output}
        </CodeBlock>
      )}
    </div>
  );
}

interface InitRowProps {
  item: InitItem;
}

function InitRow({ item }: InitRowProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body-sm text-fg-muted">
      <span className="text-body font-medium text-fg">Session started</span>
      {item.model !== null && <span className="min-w-0 font-mono wrap-anywhere">{item.model}</span>}
      {item.cwd !== null && <span className="min-w-0 font-mono wrap-anywhere">{item.cwd}</span>}
      {item.toolCount !== null && <span className="tabular-nums">{item.toolCount} tools</span>}
      {item.permissionMode !== null && (
        <span>
          permission mode <span className="font-mono">{item.permissionMode}</span>
        </span>
      )}
    </div>
  );
}

interface ModelFallbackRowProps {
  item: ModelFallbackItem;
}

function ModelFallbackRow({ item }: ModelFallbackRowProps) {
  const reason = getModelFallbackReasonLabel(item.reason);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body-sm text-fg-muted">
      <span className="text-body font-medium text-warning">Switched model</span>
      <span className="min-w-0 font-mono wrap-anywhere">
        {item.from} → <span className="text-fg">{item.to}</span>
      </span>
      {reason !== null && <span>because {reason}</span>}
    </div>
  );
}

interface TextRowProps {
  item: TextItem;
}

function TextRow({ item }: TextRowProps) {
  return <Markdown source={item.text} minHeadingLevel={3} />;
}

interface MessageRowProps {
  item: MessageItem;
}

function MessageRow({ item }: MessageRowProps) {
  const sourceLabel = getMessageSourceLabel(item.source);
  return (
    <div className="flex flex-col items-end gap-1.5 pt-6">
      {sourceLabel !== null && <p className="text-caption text-fg-muted">{sourceLabel}</p>}
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-overlay px-4 py-2.5 text-body whitespace-pre-wrap text-fg wrap-anywhere">
        {sourceLabel === null && <span className="sr-only">You wrote: </span>}
        {item.text}
      </p>
    </div>
  );
}

interface ToolRowProps {
  item: ToolItem;
  isPending: boolean;
  search: string;
}

const ToolRow = memo(function ToolRow({ item, isPending, search }: ToolRowProps) {
  const hasError = item.result?.isError === true;
  const hasSearchMatch = checkHasToolSearchMatch(item, search);
  const [isOpen, setIsOpen] = useState(false);
  const [hadSearchMatch, setHadSearchMatch] = useState(false);
  if (hasSearchMatch !== hadSearchMatch) {
    setHadSearchMatch(hasSearchMatch);
    setIsOpen(hasSearchMatch);
  }
  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger className="group flex min-h-7 w-full items-center gap-2 rounded-sm text-left font-mono text-body-sm text-fg-muted">
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 shrink-0 text-fg-faint transition-[rotate,color] duration-200 ease-out-quint group-hover:text-fg-muted group-data-[state=open]:rotate-90 group-data-[state=open]:text-fg-muted"
        />
        <span className="min-w-0 font-medium wrap-anywhere text-fg-secondary transition-colors group-hover:text-fg">
          {item.name}
        </span>
        {/* Search skips this cut-off line and finds its text in the input, which it opens. */}
        <span
          data-search-skip
          className="min-w-0 flex-1 truncate transition-colors group-hover:text-fg-secondary"
        >
          {item.preview}
        </span>
        {hasError && (
          <>
            <CircleAlert className="size-3.5 shrink-0 text-negative" />
            <span className="sr-only">Failed</span>
          </>
        )}
        {isPending && !item.result && (
          <>
            <Loader className="spin-in-place size-3.5 shrink-0 text-fg-muted" />
            <span className="sr-only">In progress</span>
          </>
        )}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="pt-1 pb-3">
          <div className="ml-[7px] space-y-3 border-l border-line-strong pl-4">
            <div>
              <div className="eyebrow mb-1.5">Input</div>
              <CodeBlock label="Tool input" className="max-h-80">
                {formatToolInput(item)}
              </CodeBlock>
            </div>
            <div>
              <div className="eyebrow mb-1.5">{hasError ? 'Error' : 'Result'}</div>
              <CodeBlock
                label={hasError ? 'Tool error' : 'Tool result'}
                className={cn(
                  'max-h-96',
                  hasError && 'border-transparent bg-negative-soft text-negative',
                )}
              >
                {item.result ? item.result.content || '(empty)' : 'No result yet'}
              </CodeBlock>
            </div>
          </div>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
});

interface FinishedRowProps {
  item: ResultItem;
}

function FinishedRow({ item }: FinishedRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-body-sm text-fg-muted">
      <CircleCheck
        aria-hidden="true"
        className="size-3.5 shrink-0 animate-in text-positive duration-300 ease-out-quint zoom-in-50 fade-in"
      />
      <span className="text-fg-secondary">{getTranscriptResultLabel(false)}</span>
      <span aria-hidden="true" className="text-fg-faint">
        ·
      </span>
      <span className="tabular-nums">
        {item.numTurns ?? '-'} {getTurnsLabel(item.numTurns)}
      </span>
      <span aria-hidden="true" className="text-fg-faint">
        ·
      </span>
      <span className="tabular-nums">{formatDuration(item.durationMs)}</span>
    </div>
  );
}

interface FailedRowProps {
  item: ResultItem;
}

function FailedRow({ item }: FailedRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-negative-soft px-4 py-3 text-body text-fg-secondary">
      <span className="flex items-center gap-2 font-medium text-negative">
        <span className="grid size-4 animate-in place-items-center rounded-full bg-negative text-page duration-300 ease-out-quint zoom-in-50 fade-in">
          <X className="size-2.5" strokeWidth={3.5} />
        </span>
        {getTranscriptResultLabel(true)}
      </span>
      <span className="tabular-nums">
        <span className="font-medium text-fg">{item.numTurns ?? '-'}</span>{' '}
        {getTurnsLabel(item.numTurns)}
      </span>
      <span className="font-medium text-fg tabular-nums">{formatDuration(item.durationMs)}</span>
    </div>
  );
}

function renderItem(item: TranscriptItem, isRunning: boolean, search: string) {
  return match(item)
    .with({ kind: 'hook' }, hook => <HookRow item={hook} />)
    .with({ kind: 'init' }, init => <InitRow item={init} />)
    .with({ kind: 'model-fallback' }, fallback => <ModelFallbackRow item={fallback} />)
    .with({ kind: 'text' }, text => <TextRow item={text} />)
    .with({ kind: 'message' }, message => <MessageRow item={message} />)
    .with({ kind: 'tool' }, tool => <ToolRow item={tool} isPending={isRunning} search={search} />)
    .with({ kind: 'result', isError: true }, result => <FailedRow item={result} />)
    .with({ kind: 'result', isError: false }, result => <FinishedRow item={result} />)
    .exhaustive();
}

interface TranscriptListProps {
  items: TranscriptItem[];
  isRunning: boolean;
  // Opens the tool calls whose input or result has the search, so it can be found there too.
  search: string;
}

export function TranscriptList({ items, isRunning, search }: TranscriptListProps) {
  // Only events that arrive after the page opens animate in, not the whole transcript.
  const [initialKeys] = useState(() => new Set(items.map(item => item.key)));
  if (items.length === 0) return <EmptyState>{getTranscriptEmptyLabel(isRunning)}</EmptyState>;
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item.key}
          className={cn(
            !initialKeys.has(item.key) &&
              'animate-in duration-300 ease-out-quint fade-in slide-in-from-bottom-1',
            checkIsSubagent(item) && 'ml-5 border-l border-line-strong pl-3',
          )}
        >
          {renderItem(item, isRunning, search)}
        </div>
      ))}
    </div>
  );
}
