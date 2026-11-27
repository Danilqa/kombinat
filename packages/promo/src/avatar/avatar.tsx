import { cn } from 'design-system';

interface AvatarProps {
  initial: string;
  isAccent?: boolean;
  className?: string;
}

export function Avatar({ initial, isAccent = false, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
        isAccent
          ? 'bg-linear-to-br from-brand-violet via-brand-pink to-brand-peach text-page'
          : 'bg-overlay text-fg-secondary',
        className,
      )}
    >
      {initial}
    </span>
  );
}
