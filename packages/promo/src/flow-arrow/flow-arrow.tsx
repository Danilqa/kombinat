import { ArrowRight } from 'lucide-react';
import { interpolate } from '../motion';

interface FlowArrowProps {
  progress: number;
}

export function FlowArrow({ progress }: FlowArrowProps) {
  return (
    <ArrowRight
      aria-hidden="true"
      style={{ opacity: progress, transform: `translateX(${interpolate(-6, 0, progress)}px)` }}
      className="size-5 shrink-0 text-fg-muted"
    />
  );
}
