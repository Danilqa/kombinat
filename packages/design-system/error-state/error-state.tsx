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
