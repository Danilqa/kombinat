import type { ReactNode } from 'react';

interface EmptyStateProps {
  children: ReactNode;
}

export function EmptyState({ children }: EmptyStateProps) {
  return (
    <p className="animate-in py-10 text-center text-body text-fg-muted duration-300 fade-in">
      {children}
    </p>
  );
}
