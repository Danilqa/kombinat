import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from 'design-system/utils';

export type WelcomeGlow = 'lavender' | 'peach' | 'mint' | 'sky';

const GLOW_CLASSES: Record<WelcomeGlow, string> = {
  lavender: 'bg-[radial-gradient(closest-side,rgba(185,168,255,0.2),transparent)]',
  peach: 'bg-[radial-gradient(closest-side,rgba(245,169,127,0.18),transparent)]',
  mint: 'bg-[radial-gradient(closest-side,rgba(76,195,138,0.16),transparent)]',
  sky: 'bg-[radial-gradient(closest-side,rgba(107,156,255,0.16),transparent)]',
};

interface WelcomeCardProps {
  label: string;
  icon: LucideIcon;
  glow: WelcomeGlow;
  title: string;
  children: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function WelcomeCard({
  label,
  icon: Icon,
  glow,
  title,
  children,
  details,
  actions,
  aside,
}: WelcomeCardProps) {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-48 -right-32 size-[560px] rounded-full',
          GLOW_CLASSES[glow],
        )}
      />
      <div
        className={cn(
          'relative grid h-full gap-6 p-5 sm:p-8 lg:gap-10',
          aside && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-center',
        )}
      >
        <div className="flex flex-col items-start gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised py-0.5 pr-2.5 pl-1 text-caption text-fg-secondary">
            <span className="flex size-[18px] items-center justify-center rounded-full bg-fg text-page">
              <Icon aria-hidden="true" className="size-3" strokeWidth={2.25} />
            </span>
            {label}
          </span>
          <h2 className="bg-linear-to-r from-[#b9a8ff] via-[#d8a7d0] to-[#f5a97f] bg-clip-text pb-0.5 text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-transparent sm:text-[28px] sm:leading-[34px]">
            {title}
          </h2>
          <div className="max-w-[56ch] text-body text-fg-secondary [&_strong]:font-medium [&_strong]:text-fg">
            {children}
          </div>
          {details && <div className="mt-2 w-full">{details}</div>}
          {actions && <div className="mt-1 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {aside && <div className="max-sm:hidden">{aside}</div>}
      </div>
    </div>
  );
}
