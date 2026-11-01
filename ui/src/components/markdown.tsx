import { memo, useMemo } from 'react';
import ReactMarkdown, { type Options } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const MAX_HEADING_LEVEL = 6;

type HeadingLevel = 2 | 3;

interface MarkdownNode {
  type: string;
  depth?: number;
  children?: MarkdownNode[];
}

interface ShiftHeadingsOptions {
  minHeadingLevel: HeadingLevel;
}

function collectHeadings(node: MarkdownNode): MarkdownNode[] {
  const nested = (node.children ?? []).flatMap(collectHeadings);
  return node.type === 'heading' ? [node, ...nested] : nested;
}

// Moves the shallowest heading in the source to minHeadingLevel and the rest along with it, so agent
// text never adds a second h1 or a peer of the page's own sections, and keeps its own outline.
function remarkShiftHeadings({ minHeadingLevel }: ShiftHeadingsOptions) {
  return (tree: MarkdownNode) => {
    const headings = collectHeadings(tree);
    const topLevel = Math.min(...headings.map(heading => heading.depth ?? MAX_HEADING_LEVEL));
    for (const heading of headings) {
      const depth = heading.depth ?? MAX_HEADING_LEVEL;
      heading.depth = Math.min(MAX_HEADING_LEVEL, depth - topLevel + minHeadingLevel);
    }
  };
}

interface MarkdownProps {
  source: string;
  minHeadingLevel: HeadingLevel;
  className?: string;
}

export const Markdown = memo(function Markdown({
  source,
  minHeadingLevel,
  className,
}: MarkdownProps) {
  const remarkPlugins = useMemo<Options['remarkPlugins']>(
    () => [remarkGfm, remarkBreaks, [remarkShiftHeadings, { minHeadingLevel }]],
    [minHeadingLevel],
  );
  return (
    <div
      className={cn(
        'markdown prose prose-sm max-w-none text-body',
        'prose-headings:font-semibold prose-headings:text-fg prose-h2:text-title-md prose-h3:text-title-sm prose-h4:text-title-sm prose-h5:text-title-sm prose-h6:text-title-sm',
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
