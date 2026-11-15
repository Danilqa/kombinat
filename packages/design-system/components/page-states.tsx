import type { ReactNode } from 'react';
import { Spinner } from './spinner';

export function LoadingState() {
  return (
    <p
      role="status"
      className="flex animate-in items-center justify-center gap-2 py-10 text-body text-fg-muted delay-150 duration-300 fill-mode-backwards fade-in"
    >
      <Spinner />
      Loading…
    </p>
  );
}

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <p
      role="alert"
      className="mb-4 animate-in rounded-lg bg-negative-soft px-4 py-3 text-body font-medium wrap-break-word text-negative duration-200 fade-in slide-in-from-top-1"
    >
      {message}
    </p>
  );
}

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
