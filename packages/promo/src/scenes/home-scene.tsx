import { BadgePercent, CalendarCheck, Globe, Umbrella, type LucideIcon } from 'lucide-react';
import { SceneHeading } from '../components/scene-heading';
import { getProgress, interpolate } from '../motion';

interface HomeRoutine {
  icon: LucideIcon;
  name: string;
  schedule: string;
  description: string;
  // When the voiceover names it, in seconds since the scene started.
  mentionedAt: number;
}

const HOME_ROUTINES: HomeRoutine[] = [
  {
    icon: BadgePercent,
    name: 'price-drops',
    schedule: 'Daily at 09:00',
    description: 'Checks a few shops for a discount on the headphones I want',
    mentionedAt: 2.7,
  },
  {
    icon: CalendarCheck,
    name: 'book-haircut',
    schedule: 'Mondays at 08:00',
    description: 'Books the first free Saturday slot at my barber',
    mentionedAt: 4.1,
  },
  {
    icon: Umbrella,
    name: 'weather',
    schedule: 'Weekdays at 08:00',
    description: 'Says if I need an umbrella today',
    mentionedAt: 5.7,
  },
  {
    icon: Globe,
    name: 'visa-dates',
    schedule: 'Every 30 minutes',
    description: 'Checks the consulate’s website for new appointment dates',
    mentionedAt: 7,
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
          const rise = getProgress(time, 0.5 + index * 0.15, 0.6);
          const nextMention = HOME_ROUTINES[index + 1]?.mentionedAt ?? Infinity;
          const highlight =
            getProgress(time, routine.mentionedAt, 0.3) * (1 - getProgress(time, nextMention, 0.3));
          return (
            <div
              key={routine.name}
              style={{
                opacity: rise,
                transform: `translateY(${String(interpolate(20, 0, rise) - 6 * highlight)}px)`,
                boxShadow: `0 0 0 1px rgba(245, 176, 138, ${String(0.55 * highlight)}), 0 16px 40px -16px rgba(245, 176, 138, ${String(0.35 * highlight)})`,
              }}
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
