import type { LucideIcon } from 'lucide-react';
import { cn } from 'design-system';
import { interpolate } from '../motion';

interface RoutineCardProps {
  icon: LucideIcon;
  name: string;
  schedule: string;
  description: string;
  rise: number;
  spotlight: number;
  isDashed?: boolean;
  className?: string;
}

export function RoutineCard({
  icon: Icon,
  name,
  schedule,
  description,
  rise,
  spotlight,
  isDashed = false,
  className,
}: RoutineCardProps) {
  return (
    <div
      style={{
        opacity: rise,
        transform: `translateY(${String(interpolate(20, 0, rise) - 6 * spotlight)}px)`,
        boxShadow: `0 0 0 1px rgba(245, 176, 138, ${String(0.55 * spotlight)}), 0 16px 40px -16px rgba(245, 176, 138, ${String(0.35 * spotlight)})`,
      }}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4',
        isDashed ? 'border-dashed border-line-strong bg-transparent' : 'border-line bg-surface',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-raised">
          <Icon className="size-4.5 text-brand-peach" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-[14px] font-semibold">{name}</span>
          <span className="text-[12.5px] text-fg-muted">{schedule}</span>
        </div>
      </div>
      <p className="text-[14px] leading-5 text-fg-prose">{description}</p>
    </div>
  );
}
