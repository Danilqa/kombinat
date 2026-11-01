export function LoadingState() {
  return <p className="py-10 text-center text-grey-60">Loading…</p>;
}

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <p className="rounded-8 bg-light-red-20 px-4 py-3 text-paragraph-14 font-medium text-dark-red">
      {message}
    </p>
  );
}
