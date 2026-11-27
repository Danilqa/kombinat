import { Ban, Check, Clock, Hourglass, Loader, RotateCcw, X } from 'lucide-react';
import { P, match } from 'ts-pattern';
import { cn } from 'design-system';
import type { CalendarEntry } from 'domains/calendar/types';
import type { RunStatus, RunStatusTone } from 'domains/run/types';
import { getRunStatusTone } from 'domains/run/utils';

export type BlockVariant = 'planned' | 'plannedDefault' | RunStatus;

interface BlockStyle {
  className: string;
  icon: BlockIcon | null;
  iconMotionClassName?: string;
}

interface BlockIcon {
  component: typeof Check;
  className: string;
}

// Opaque tints, so the current-time line passes behind a block instead of through its text.
const toneSurfaceClassNames: Record<RunStatusTone, string> = {
  positive: 'bg-positive-tint shadow-stripe-positive',
  negative: 'bg-negative-tint shadow-stripe-negative',
  warning: 'bg-warning-tint shadow-stripe-warning',
  info: 'bg-info-tint shadow-stripe-info',
  ghost: 'bg-neutral-tint shadow-stripe-neutral',
};

const toneIconClassNames: Record<RunStatusTone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
  info: 'text-info',
  ghost: 'text-fg-muted',
};

// The icon repeats the outcome that the tint shows, so it does not depend on colour alone.
const statusIcons: Record<RunStatus, typeof Check> = {
  succeeded: Check,
  failed: X,
  timed_out: Clock,
  aborted: Ban,
  running: Loader,
  waiting: Hourglass,
  retrying: RotateCcw,
};

const outlinedBlockClassName = 'hover:border-fg-faint';
const tintedBlockClassName = 'pl-1.75 hover:brightness-125 focus-visible:shadow-focus';

export function getBlockSurfaceClassName(variant: BlockVariant): string {
  return match(variant)
    .with('planned', () => 'border border-line-strong bg-raised')
    .with('plannedDefault', () => 'border border-dashed border-line-strong bg-raised')
    .with(P.string, status => toneSurfaceClassNames[getRunStatusTone(status)])
    .exhaustive();
}

function getBlockIcon(status: RunStatus): BlockIcon {
  return {
    component: statusIcons[status],
    className: toneIconClassNames[getRunStatusTone(status)],
  };
}

export function getBlockStyle(variant: BlockVariant): BlockStyle {
  const surfaceClassName = getBlockSurfaceClassName(variant);
  return match(variant)
    .with('planned', 'plannedDefault', (): BlockStyle => ({
      className: cn(surfaceClassName, outlinedBlockClassName),
      icon: null,
    }))
    .with('running', (status): BlockStyle => ({
      className: cn(surfaceClassName, tintedBlockClassName, 'animate-soft-pulse'),
      icon: getBlockIcon(status),
      iconMotionClassName: 'spin-in-place [--spin-duration:2s]',
    }))
    .with(P.string, (status): BlockStyle => ({
      className: cn(surfaceClassName, tintedBlockClassName),
      icon: getBlockIcon(status),
    }))
    .exhaustive();
}

export function getBlockVariant(entry: CalendarEntry): BlockVariant {
  return match(entry)
    .with({ kind: 'planned', estimated: true }, () => 'planned' as const)
    .with({ kind: 'planned', estimated: false }, () => 'plannedDefault' as const)
    .with({ kind: 'run' }, run => run.status)
    .exhaustive();
}
