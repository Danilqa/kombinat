import { BrandMark } from 'design-system';
import { AccentText } from '../../heading';
import { getProgress, toRiseStyle } from '../../motion';

interface TitleSceneProps {
  time: number;
}

// When the voiceover reaches "while you focus on what matters".
const FOCUS_AT = 3.6;

export function TitleScene({ time }: TitleSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-9">
      <div style={toRiseStyle(getProgress(time, 0.1, 0.7), 18)} className="flex items-center gap-4">
        <BrandMark className="size-13" />
        <span className="text-[54px] leading-none font-semibold tracking-[-0.035em]">Kombinat</span>
      </div>
      <div className="flex flex-col items-center gap-1 text-center text-[44px] leading-13.5 font-semibold tracking-tight">
        <span style={toRiseStyle(getProgress(time, 0.6, 0.7))}>AI agents that work 24/7,</span>
        <span style={toRiseStyle(getProgress(time, FOCUS_AT, 0.7))}>
          while you focus on <AccentText>what matters</AccentText>
        </span>
      </div>
      <p
        style={toRiseStyle(getProgress(time, FOCUS_AT + 0.9, 0.7))}
        className="text-center text-[20px] leading-7 text-fg-secondary"
      >
        Run on a schedule or webhook, from Markdown files in your repo
      </p>
    </div>
  );
}
