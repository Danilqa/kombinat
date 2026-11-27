import { getProgress, toRiseStyle } from '../motion';
import { AccentText } from './accent-text';

interface SceneHeadingProps {
  time: number;
  title: string;
  accent: string;
  subtitle?: string;
}

export function SceneHeading({ time, title, accent, subtitle }: SceneHeadingProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1
        style={toRiseStyle(getProgress(time, 0, 0.6))}
        className="text-[38px] leading-11.5 font-semibold tracking-tight"
      >
        {title} <AccentText>{accent}</AccentText>
      </h1>
      {subtitle !== undefined && (
        <p
          style={toRiseStyle(getProgress(time, 0.15, 0.6))}
          className="text-[19px] leading-6.5 text-fg-secondary"
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
