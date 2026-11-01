import { Check, ChevronRight, CircleAlert, Loader, X } from 'lucide-react';
import { memo, useState } from 'react';
import { match } from 'ts-pattern';

import { Markdown } from '@/components/markdown';
import type { HookItem, InitItem, ResultItem, TextItem, ToolItem, TranscriptItem } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

interface HookRowProps {
  item: HookItem;
}

function HookRow({ item }: HookRowProps) {
  return (
    <div className="space-y-2 text-paragraph-12 text-grey-60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-title-14 text-black">Before hook</span>
        <span className="font-mono">{item.command}</span>
        <span className={cn('font-mono', item.exitCode !== 0 && 'text-dark-red')}>
          exit {item.exitCode ?? '?'}
        </span>
      </div>
      {item.output && (
        <pre className="max-h-60 overflow-auto rounded-8 bg-grey-5 p-3 font-mono break-words whitespace-pre-wrap text-black">
          {item.output}
        </pre>
      )}
    </div>
  );
}

interface InitRowProps {
  item: InitItem;
}

function InitRow({ item }: InitRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-paragraph-12 text-grey-60">
      <span className="text-title-14 text-black">Session started</span>
      {item.model !== null && <span className="font-mono">{item.model}</span>}
      {item.cwd !== null && <span className="font-mono">{item.cwd}</span>}
      {item.toolCount !== null && <span>{item.toolCount} tools</span>}
      {item.permissionMode !== null && <span>permission mode {item.permissionMode}</span>}
    </div>
  );
}

interface TextRowProps {
  item: TextItem;
}

function TextRow({ item }: TextRowProps) {
  return <Markdown source={item.text} />;
}

interface ToolRowProps {
  item: ToolItem;
  isPending: boolean;
}

const ToolRow = memo(function ToolRow({ item, isPending }: ToolRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasError = item.result?.isError === true;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-8 border border-grey-10 bg-white',
        isOpen &&
          'before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-[3px] before:bg-black',
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(open => !open)}
        className="flex w-full items-center gap-2 py-2 pr-3 pl-3 text-left hover:bg-grey-2"
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-grey-40 transition-transform',
            isOpen && 'rotate-90 text-black',
          )}
        />
        <span className="shrink-0 font-mono text-paragraph-12 font-medium text-black">
          {item.name}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-paragraph-12 text-grey-60">
          {item.preview}
        </span>
        {hasError && <CircleAlert className="size-3.5 shrink-0 text-dark-red" />}
        {isPending && !item.result && (
          <Loader className="size-3.5 shrink-0 animate-spin text-grey-60" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-3 border-t border-grey-10 p-3 pl-4">
          <div>
            <div className="eyebrow mb-2">Input</div>
            <pre className="max-h-80 overflow-auto rounded-8 bg-grey-5 p-3 font-mono text-paragraph-12 break-words whitespace-pre-wrap text-black">
              {JSON.stringify(item.input, null, 2)}
            </pre>
          </div>
          <div>
            <div className="eyebrow mb-2">{hasError ? 'Error' : 'Result'}</div>
            <pre
              className={cn(
                'max-h-96 overflow-auto rounded-8 bg-grey-5 p-3 font-mono text-paragraph-12 break-words whitespace-pre-wrap text-black',
                hasError && 'bg-light-red-20 text-dark-red',
              )}
            >
              {item.result ? item.result.content || '(empty)' : 'No result yet'}
            </pre>
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
  dotClassName: string;
  icon: typeof Check;
}

function getResultAppearance(isError: boolean): ResultAppearance {
  return match(isError)
    .with(true, () => ({
      label: 'Finished with error',
      className: 'bg-light-red-20',
      labelClassName: 'text-dark-red',
      dotClassName: 'bg-dark-red',
      icon: X,
    }))
    .with(false, () => ({
      label: 'Finished',
      className: 'bg-grey-5',
      labelClassName: 'text-black',
      dotClassName: 'bg-dark-green',
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
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-8 px-4 py-3 text-paragraph-14 text-grey-60',
        appearance.className,
      )}
    >
      <span className={cn('flex items-center gap-2 text-title-14', appearance.labelClassName)}>
        <span
          className={cn(
            'grid size-4 place-items-center rounded-full text-white',
            appearance.dotClassName,
          )}
        >
          <Icon className="size-2.5" strokeWidth={3.5} />
        </span>
        {appearance.label}
      </span>
      <span className="tabular-nums">
        <span className="font-mono text-black">{item.numTurns ?? '-'}</span> turns
      </span>
      <span className="font-mono text-black tabular-nums">{formatDuration(item.durationMs)}</span>
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
      <p className="py-8 text-center text-paragraph-14 text-grey-60">
        {isRunning ? 'Waiting for the first events…' : 'No transcript events.'}
      </p>
    );
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div
          key={item.key}
          className={cn(getIsSubagent(item) && 'ml-5 border-l-2 border-grey-15 pl-3')}
        >
          {renderItem(item, isRunning)}
        </div>
      ))}
    </div>
  );
}
