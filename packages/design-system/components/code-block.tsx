import type { ReactNode } from 'react';
import { cn } from '../utils';

interface CodeBlockProps {
  label: string;
  children: ReactNode;
  className?: string;
}

// Height-capped blocks scroll, so they are focusable named regions that keyboard users can scroll.
export function CodeBlock({ label, children, className }: CodeBlockProps) {
  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn(
        'overflow-auto rounded-lg border border-line-faint bg-raised p-3 font-mono text-body-sm break-words whitespace-pre-wrap text-fg-prose',
        className,
      )}
    >
      {children}
    </pre>
  );
}
