import { cn } from '../utils';

const SMOKE_PATH = 'M46.4 23.21A9 9 0 0 1 46.4 10.48L52.88 4L55.71 6.83A5 5 0 0 1 55.71 13.9Z';
const SMOKE_CLASS_NAME = 'origin-[47px_23px] animate-smoke-drift';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('size-4.5 shrink-0 overflow-visible', className)}
    >
      <path d="M15.82 60H6.82A24 24 0 0 1 13.85 43.03L21.38 35.5V46.57A4 4 0 0 1 20.21 49.4A15 15 0 0 0 15.82 60Z" />
      <path d="M28.82 60H19.82A11 11 0 0 1 23.04 52.22L39.77 35.5V46.57A4 4 0 0 1 38.6 49.4L29.41 58.59A2 2 0 0 0 28.82 60Z" />
      <path d="M52.77 60H43.77V35.23A9 9 0 0 1 46.4 28.86L52.77 22.5Z" />
      <path d={SMOKE_PATH} className={SMOKE_CLASS_NAME} />
      <path d={SMOKE_PATH} className={cn(SMOKE_CLASS_NAME, '[animation-delay:-1.8s]')} />
    </svg>
  );
}
