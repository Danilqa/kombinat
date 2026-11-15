import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from 'design-system/utils';
import { GLASS_CLASS } from './glass';

export type WelcomeGlow = 'lavender' | 'peach' | 'mint' | 'sky';

const GLOW_CLASSES: Record<WelcomeGlow, string> = {
  lavender: 'bg-[radial-gradient(closest-side,rgba(185,168,255,0.4),transparent)]',
  peach: 'bg-[radial-gradient(closest-side,rgba(245,169,127,0.38),transparent)]',
  mint: 'bg-[radial-gradient(closest-side,rgba(76,195,138,0.32),transparent)]',
  sky: 'bg-[radial-gradient(closest-side,rgba(107,156,255,0.36),transparent)]',
};

const GLOW_PARTNERS: Record<WelcomeGlow, WelcomeGlow> = {
  lavender: 'peach',
  peach: 'lavender',
  mint: 'sky',
  sky: 'lavender',
};

const ORBIT_CLASS =
  'pointer-events-none absolute inset-0 sm:[animation-duration:48s] sm:[animation-name:glow-orbit-wide]';

const GLOW_BASE_CLASS =
  'absolute top-0 left-0 size-[420px] -translate-1/2 rounded-full sm:size-[560px]';

const PLAY_WHILE_ACTIVE_CLASS =
  '[animation-play-state:paused] group-data-active/slide:[animation-play-state:running]';

interface WelcomeCardProps {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
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
  iconClassName,
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
        className={cn(ORBIT_CLASS, 'translate-x-full animate-glow-orbit', PLAY_WHILE_ACTIVE_CLASS)}
      >
        <div className={cn(GLOW_BASE_CLASS, GLOW_CLASSES[glow])} />
      </div>
      <div
        aria-hidden="true"
        className={cn(
          ORBIT_CLASS,
          'animate-glow-orbit-offset motion-reduce:hidden sm:[animation-delay:-24s]',
          PLAY_WHILE_ACTIVE_CLASS,
        )}
      >
        <div className={cn(GLOW_BASE_CLASS, GLOW_CLASSES[GLOW_PARTNERS[glow]])} />
      </div>
      <div
        className={cn(
          'relative grid h-full gap-6 p-5 sm:p-8 lg:gap-10',
          aside && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-center',
        )}
      >
        <div className="flex flex-col items-start gap-4">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1 text-caption text-fg-secondary',
              GLASS_CLASS,
            )}
          >
            <span className="flex size-[18px] items-center justify-center rounded-full bg-fg text-page">
              <Icon aria-hidden="true" className={cn('size-3', iconClassName)} strokeWidth={2.25} />
            </span>
            {label}
          </span>
          <h2
            className={cn(
              'animate-title-flow bg-[linear-gradient(90deg,#b9a8ff,#d8a7d0,#f5a97f,#d8a7d0,#b9a8ff)] bg-size-[200%_100%] bg-clip-text pb-0.5 text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-transparent sm:text-[28px] sm:leading-[34px]',
              PLAY_WHILE_ACTIVE_CLASS,
            )}
          >
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
