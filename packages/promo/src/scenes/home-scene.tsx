import { Bell } from 'lucide-react';
import { SceneHeading } from '../components/scene-heading';
import { getProgress, toPopStyle, toRiseStyle } from '../motion';
import { HOME_ROUTINES } from './home-routines';

interface HomeSceneProps {
  time: number;
}

export function HomeScene({ time }: HomeSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 pb-4">
      <SceneHeading
        time={time}
        title="And for"
        accent="life at home"
        subtitle="A Mac at home runs your personal routines too."
      />
      <div className="flex gap-5">
        {HOME_ROUTINES.map((routine, index) => {
          const Icon = routine.icon;
          return (
            <div
              key={routine.name}
              style={toRiseStyle(getProgress(time, 0.5 + index * 0.18, 0.6), 20)}
              className="flex h-[292px] w-[268px] flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-raised">
                <Icon className="size-5 text-brand-peach" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[15px] font-semibold">{routine.name}</span>
                <span className="text-[13px] text-fg-muted">{routine.schedule}</span>
              </div>
              <p className="text-[15px] leading-[22px] text-fg-prose">{routine.description}</p>
              <div
                style={toPopStyle(getProgress(time, 2.4 + index * 0.45, 0.45))}
                className="mt-auto flex items-start gap-2 rounded-xl bg-raised px-3 py-2.5 text-[14px] leading-[20px]"
              >
                <Bell className="mt-0.5 size-4 shrink-0 text-brand-violet" />
                {routine.message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
