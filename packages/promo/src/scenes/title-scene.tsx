import { BrandMark } from 'design-system/icons';
import { AccentText } from '../components/accent-text';
import { getProgress, toRiseStyle } from '../motion';

interface TitleSceneProps {
  time: number;
}

export function TitleScene({ time }: TitleSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-7">
      <div style={toRiseStyle(getProgress(time, 0.1, 0.7), 18)} className="flex items-center gap-4">
        <BrandMark className="size-15" />
        <span className="text-[64px] leading-none font-semibold tracking-[-0.035em]">Kombinat</span>
      </div>
      <p
        style={toRiseStyle(getProgress(time, 0.55, 0.7))}
        className="text-center text-[25px] leading-[36px] text-fg-secondary"
      >
        Run agents on a schedule or webhook,
        <br />
        from <AccentText>Markdown files</AccentText> in your repo
      </p>
    </div>
  );
}
