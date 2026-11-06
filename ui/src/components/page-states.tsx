export function LoadingState() {
  return (
    <p role="status" className="py-10 text-center text-body text-fg-muted">
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
      className="mb-4 rounded-lg bg-negative-soft px-4 py-3 text-body font-medium wrap-break-word text-negative"
    >
      {message}
    </p>
  );
}
