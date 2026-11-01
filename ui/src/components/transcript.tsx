import { Check, ChevronRight, CircleAlert, Loader, X } from 'lucide-react';
import { memo, useId, useState } from 'react';
import { match } from 'ts-pattern';

import { CodeBlock } from '@/components/code-block';
import { Markdown } from '@/components/markdown';
import type { HookItem, InitItem, ResultItem, TextItem, ToolItem, TranscriptItem } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

interface HookRowProps {
  item: HookItem;
}

function HookRow({ item }: HookRowProps) {
  return (
    <div className="space-y-2 text-body-sm text-fg-muted">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-body font-medium text-fg">Before hook</span>
        <span className="font-mono">{item.command}</span>
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
      {item.model !== null && <span className="font-mono">{item.model}</span>}
      {item.cwd !== null && <span className="font-mono">{item.cwd}</span>}
      {item.toolCount !== null && <span className="tabular-nums">{item.toolCount} tools</span>}
      {item.permissionMode !== null && (
        <span>
          permission mode <span className="font-mono">{item.permissionMode}</span>
        </span>
      )}
    </div>
  );
}

interface TextRowProps {
  item: TextItem;
}

function TextRow({ item }: TextRowProps) {
  return <Markdown source={item.text} minHeadingLevel={3} />;
}

interface ToolRowProps {
  item: ToolItem;
  isPending: boolean;
}

const ToolRow = memo(function ToolRow({ item, isPending }: ToolRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const hasError = item.result?.isError === true;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-surface has-[:focus-visible]:border-fg-muted',
        isOpen &&
          'before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-0.5 before:bg-fg-muted',
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(open => !open)}
        className="flex h-9 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:-outline-offset-2"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 text-fg-muted transition-transform',
            isOpen && 'rotate-90 text-fg',
          )}
        />
        <span className="shrink-0 font-mono text-body-sm font-medium text-fg">{item.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-body-sm text-fg-muted">
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
            <Loader className="size-3.5 shrink-0 animate-spin text-fg-muted" />
            <span className="sr-only">In progress</span>
          </>
        )}
      </button>
      {isOpen && (
        <div id={panelId} className="space-y-3 border-t border-line-faint p-3">
          <div>
            <div className="eyebrow mb-1.5">Input</div>
            <CodeBlock label="Tool input" className="max-h-80">
              {JSON.stringify(item.input, null, 2)}
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
      )}
    </div>
  );
});

interface ResultAppearance {
  label: string;
  className: string;
  labelClassName: string;
  iconClassName: string;
  icon: typeof Check;
}

function getResultAppearance(isError: boolean): ResultAppearance {
  return match(isError)
    .with(true, () => ({
      label: 'Finished with error',
      className: 'bg-negative-soft',
      labelClassName: 'text-negative',
      iconClassName: 'bg-negative',
      icon: X,
    }))
    .with(false, () => ({
      label: 'Finished',
      className: 'bg-positive-soft',
      labelClassName: 'text-positive',
      iconClassName: 'bg-positive',
      icon: Check,
    }))
    .exhaustive();
}

interface ResultRowProps {
  item: ResultItem;
}

function ResultRow({ item }: ResultRowProps) {
  const appearance = getResultAppearance(item.isError);
  const Icon = appearance.icon;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-4 py-3 text-body text-fg-secondary',
        appearance.className,
      )}
    >
      <span className={cn('flex items-center gap-2 font-medium', appearance.labelClassName)}>
        <span
          className={cn(
            'grid size-4 place-items-center rounded-full text-page',
            appearance.iconClassName,
          )}
        >
          <Icon className="size-2.5" strokeWidth={3.5} />
        </span>
        {appearance.label}
      </span>
      <span className="tabular-nums">
        <span className="font-medium text-fg">{item.numTurns ?? '-'}</span> turns
      </span>
      <span className="font-medium text-fg tabular-nums">{formatDuration(item.durationMs)}</span>
    </div>
  );
}

function renderItem(item: TranscriptItem, isRunning: boolean) {
  return match(item)
    .with({ kind: 'hook' }, hook => <HookRow item={hook} />)
    .with({ kind: 'init' }, init => <InitRow item={init} />)
    .with({ kind: 'text' }, text => <TextRow item={text} />)
    .with({ kind: 'tool' }, tool => <ToolRow item={tool} isPending={isRunning} />)
    .with({ kind: 'result' }, result => <ResultRow item={result} />)
    .exhaustive();
}

function getIsSubagent(item: TranscriptItem): boolean {
  return 'isSubagent' in item && item.isSubagent;
}

interface TranscriptProps {
  items: TranscriptItem[];
  isRunning: boolean;
}

export function Transcript({ items, isRunning }: TranscriptProps) {
  if (items.length === 0)
    return (
      <p className="py-10 text-center text-body text-fg-muted">
        {isRunning ? 'Waiting for the first events…' : 'No transcript events.'}
      </p>
    );
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item.key}
          className={cn(getIsSubagent(item) && 'ml-5 border-l border-line-strong pl-3')}
        >
          {renderItem(item, isRunning)}
        </div>
      ))}
    </div>
  );
}
