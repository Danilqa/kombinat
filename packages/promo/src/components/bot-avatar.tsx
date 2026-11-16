import { BrandMark } from 'design-system/icons';
import { cn } from 'design-system/utils';

interface BotAvatarProps {
  className?: string;
}

export function BotAvatar({ className }: BotAvatarProps) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-fg text-page',
        className,
      )}
    >
      <BrandMark className="size-4" />
    </span>
  );
}
