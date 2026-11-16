import { BadgePercent, CalendarCheck, Globe, Umbrella, type LucideIcon } from 'lucide-react';
import { SceneHeading } from '../components/scene-heading';
import { getProgress, toRiseStyle } from '../motion';

interface HomeRoutine {
  icon: LucideIcon;
  name: string;
  schedule: string;
  description: string;
}

const HOME_ROUTINES: HomeRoutine[] = [
  {
    icon: BadgePercent,
    name: 'price-drops',
    schedule: 'Daily at 09:00',
    description: 'Checks a few shops for a discount on the headphones I want',
  },
  {
    icon: CalendarCheck,
    name: 'book-haircut',
    schedule: 'Mondays at 08:00',
    description: 'Books the first free Saturday slot at my barber',
  },
  {
    icon: Umbrella,
    name: 'weather',
    schedule: 'Weekdays at 08:00',
    description: 'Says if I need an umbrella today',
  },
  {
    icon: Globe,
    name: 'visa-dates',
    schedule: 'Every 30 minutes',
    description: 'Checks the consulate’s website for new appointment dates',
  },
];

interface HomeSceneProps {
  time: number;
}

export function HomeScene({ time }: HomeSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 pb-4">
      <SceneHeading
        time={time}
        title="For your team, and for"
        accent="life at home"
        subtitle="Routines for yourself run the same way, on a Mac at home."
      />
      <div className="flex gap-5">
        {HOME_ROUTINES.map((routine, index) => {
          const Icon = routine.icon;
          return (
            <div
              key={routine.name}
              style={toRiseStyle(getProgress(time, 0.5 + index * 0.15, 0.6), 20)}
              className="flex w-[268px] flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised">
                  <Icon className="size-5 text-brand-peach" />
                </span>
                <div className="flex flex-col">
                  <span className="font-mono text-[15px] font-semibold">{routine.name}</span>
                  <span className="text-[13px] text-fg-muted">{routine.schedule}</span>
                </div>
              </div>
              <p className="text-[15px] leading-[22px] text-fg-prose">{routine.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
