import { cn } from '../utils';

const BAR_XS = [1, 7, 13, 19];

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 9 24 6"
      fill="currentColor"
      className={cn('aspect-4/1 w-5 shrink-0 spinner-steps', className)}
    >
      {BAR_XS.map(x => (
        <rect key={x} x={x} y={9} width={4} height={6} rx={1.25} />
      ))}
    </svg>
  );
}
