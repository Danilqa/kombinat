import { BrandMark } from 'design-system/icons';
import { getProgress, toRiseStyle } from '../motion';

interface OutroSceneProps {
  time: number;
}

export function OutroScene({ time }: OutroSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
      <div style={toRiseStyle(getProgress(time, 0.1, 0.6), 16)} className="flex items-center gap-4">
        <BrandMark className="size-13" />
        <span className="text-[54px] leading-none font-semibold tracking-[-0.035em]">Kombinat</span>
      </div>
      <div
        style={toRiseStyle(getProgress(time, 0.35, 0.6))}
        className="rounded-2xl border border-line bg-surface px-7 py-4 font-mono text-[28px]"
      >
        <span className="text-fg-faint">$ </span>
        npx <span className="text-brand-peach">kombinat init</span>
      </div>
      <div
        style={toRiseStyle(getProgress(time, 0.6, 0.6))}
        className="flex flex-col items-center gap-3"
      >
        <span className="text-[24px]">github.com/Danilqa/kombinat</span>
        <span className="text-[17px] text-fg-muted">Open source · MIT · macOS and Linux</span>
      </div>
    </div>
  );
}
