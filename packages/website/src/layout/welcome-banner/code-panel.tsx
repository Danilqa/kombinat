import type { ReactNode } from 'react';

interface CodePanelProps {
  title: string;
  children: ReactNode;
}

export function CodePanel({ title, children }: CodePanelProps) {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-page/70 backdrop-blur-sm">
      <figcaption className="border-b border-line-faint px-4 py-2 font-mono text-caption text-fg-muted">
        {title}
      </figcaption>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-body-sm text-fg-prose">
        {children}
      </pre>
    </figure>
  );
}
