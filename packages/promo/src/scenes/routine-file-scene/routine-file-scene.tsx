import { CodeLine, FIX_E2E_TESTS_LINES, WindowCard } from '../../code-window';
import { SceneHeading } from '../../heading';
import { getProgress, toRiseStyle } from '../../motion';

const LINE_HEIGHT = 30;
// The window bar and the top padding of the code.
const CODE_TOP = 41 + 20;

interface Annotation {
  label: string;
  firstLine: number;
  lastLine: number;
  start: number;
}

const ANNOTATIONS: Annotation[] = [
  { label: 'Schedule and settings', firstLine: 0, lastLine: 6, start: 2.3 },
  { label: 'The prompt', firstLine: 8, lastLine: 10, start: 3.1 },
];

interface RoutineFileSceneProps {
  time: number;
}

export function RoutineFileScene({ time }: RoutineFileSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center pt-18">
      <SceneHeading time={time} title="A routine is a" accent="Markdown file" />
      <div className="relative mt-10 mr-45">
        <WindowCard
          folder="routines/"
          file="fix-e2e-tests.md"
          style={toRiseStyle(getProgress(time, 0.25, 0.7), 20)}
          className="w-197.5"
        >
          <div className="relative py-5 pr-6 pl-3 font-mono text-[16.5px]">
            {FIX_E2E_TESTS_LINES.map((tokens, index) => (
              <CodeLine
                key={index}
                number={index + 1}
                tokens={tokens}
                style={{
                  height: LINE_HEIGHT,
                  lineHeight: `${LINE_HEIGHT}px`,
                  opacity: getProgress(time, 0.6 + index * 0.1, 0.35),
                }}
              />
            ))}
          </div>
        </WindowCard>
        {ANNOTATIONS.map(annotation => {
          const progress = getProgress(time, annotation.start, 0.5);
          return (
            <div
              key={annotation.label}
              className="absolute left-full ml-8 flex items-center gap-3"
              style={{
                top: CODE_TOP + annotation.firstLine * LINE_HEIGHT + 4,
                height: (annotation.lastLine - annotation.firstLine + 1) * LINE_HEIGHT - 8,
                opacity: progress,
                transform: `translateX(${(1 - progress) * -10}px)`,
              }}
            >
              <span className="h-full w-0.75 rounded-full bg-linear-to-b from-brand-violet to-brand-peach" />
              <span className="text-[17px] whitespace-nowrap text-fg">{annotation.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
