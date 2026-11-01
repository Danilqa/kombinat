import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const remarkPlugins = [remarkGfm, remarkBreaks];

interface MarkdownProps {
  source: string;
  className?: string;
}

export const Markdown = memo(function Markdown({ source, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        'markdown prose prose-sm max-w-none text-body',
        'prose-headings:font-semibold prose-headings:text-fg prose-h1:text-title-md prose-h2:text-title-sm prose-h3:text-title-sm',
        'prose-p:my-2 prose-li:my-0.5',
        'prose-table:text-body-sm prose-th:font-medium prose-th:text-fg-muted prose-td:text-fg-prose',
        'prose-pre:rounded-lg prose-pre:border prose-pre:border-line-faint prose-pre:bg-raised prose-pre:p-3 prose-pre:font-mono prose-pre:text-body-sm prose-pre:text-fg-prose',
        'prose-code:rounded-sm prose-code:bg-neutral-soft prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-body-sm prose-code:font-normal prose-code:text-fg prose-code:before:content-none prose-code:after:content-none',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins}>{source}</ReactMarkdown>
    </div>
  );
});
