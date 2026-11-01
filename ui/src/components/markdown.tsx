import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const remarkPlugins = [remarkGfm, remarkBreaks];

export const Markdown = memo(function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'markdown prose prose-sm max-w-none text-paragraph-14 prose-headings:font-semibold prose-h1:text-title-16 prose-h2:text-title-14 prose-h3:text-title-14 prose-p:my-2 prose-li:my-0.5 prose-pre:rounded-8 prose-pre:bg-grey-5 prose-pre:font-mono prose-pre:text-paragraph-12 prose-pre:text-black prose-code:font-mono prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none prose-code:bg-grey-10 prose-code:rounded-4 prose-code:px-1 prose-code:py-0.5 prose-code:font-normal',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins}>{source}</ReactMarkdown>
    </div>
  );
});
