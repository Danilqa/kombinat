import { cn } from 'design-system';
import { getBlockStyle, getBlockSurfaceClassName, type BlockVariant } from './block-styles';

interface LegendItem {
  label: string;
  variant: BlockVariant;
}

const legendItems: LegendItem[] = [
  { label: 'Planned', variant: 'planned' },
  { label: 'Planned, no past runs', variant: 'plannedDefault' },
  { label: 'Succeeded', variant: 'succeeded' },
  { label: 'Failed', variant: 'failed' },
  { label: 'Timed out', variant: 'timed_out' },
  { label: 'Aborted', variant: 'aborted' },
  { label: 'Running', variant: 'running' },
  { label: 'Waiting for limit', variant: 'waiting' },
  { label: 'Retrying', variant: 'retrying' },
];

interface LegendSwatchProps {
  variant: BlockVariant;
}

function LegendSwatch({ variant }: LegendSwatchProps) {
  const icon = getBlockStyle(variant).icon;
  const Icon = icon?.component;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-3.5 w-5 items-center justify-center rounded-xs',
        getBlockSurfaceClassName(variant),
      )}
    >
      {Icon && <Icon strokeWidth={3} className={cn('size-2.5', icon.className)} />}
    </span>
  );
}

interface CalendarLegendProps {
  isHighlightingOverlaps: boolean;
}

export function CalendarLegend({ isHighlightingOverlaps }: CalendarLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-body-sm text-fg-muted">
      {legendItems.map(item => (
        <span key={item.label} className="flex items-center gap-1.5">
          <LegendSwatch variant={item.variant} />
          {item.label}
        </span>
      ))}
      {isHighlightingOverlaps && (
        <span className="flex animate-in items-center gap-1.5 duration-200 fade-in slide-in-from-left-1">
          <span className="size-1.5 rounded-full bg-surface shadow-outline-negative" />
          Overlaps another routine
        </span>
      )}
    </div>
  );
}
