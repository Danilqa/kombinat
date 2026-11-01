import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('size-4.5 shrink-0', className)}
    >
      <rect x="2" y="2" width="4" height="14" rx="1" />
      <path d="M12.6 2H16L10.6 9L16 16H12.6L7.2 9Z" />
    </svg>
  );
}
