import { Spinner } from '../spinner';

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
