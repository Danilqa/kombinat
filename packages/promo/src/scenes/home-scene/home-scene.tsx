import {
  BadgePercent,
  CalendarCheck,
  Globe,
  Sparkles,
  Umbrella,
  type LucideIcon,
} from 'lucide-react';
import { RoutineCard } from '../../routine-card';
import { SceneHeading } from '../../heading';
import { getProgress, getSpotlight } from '../../motion';

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
    description: 'Looks for a discount on the headphones I want',
    mentionedAt: 3.9,
  },
  {
    icon: CalendarCheck,
    name: 'book-haircut',
    schedule: 'Mondays at 08:00',
    description: 'Books the first free Saturday slot at my barber',
    mentionedAt: 5.4,
  },
  {
    icon: Umbrella,
    name: 'weather',
    schedule: 'Weekdays at 08:00',
    description: 'Says if I need an umbrella today',
    mentionedAt: 6.9,
  },
  {
    icon: Globe,
    name: 'visa-dates',
    schedule: 'Every 30 minutes',
    description: 'Checks the consulate’s website for new dates',
    mentionedAt: 8.4,
  },
];

// When the voiceover says anything you can imagine.
const IDEA_MENTIONED_AT = 2.05;
const MENTIONS = [...HOME_ROUTINES.map(routine => routine.mentionedAt), IDEA_MENTIONED_AT];

interface HomeSceneProps {
  time: number;
}

export function HomeScene({ time }: HomeSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 pb-4">
      <SceneHeading
        time={time}
        title="And at home,"
        accent="anything you can imagine"
        subtitle="Personal routines run the same way, on a Mac at home."
      />
      <div className="flex gap-4">
        {HOME_ROUTINES.map((routine, index) => (
          <RoutineCard
            key={routine.name}
            icon={routine.icon}
            name={routine.name}
            schedule={routine.schedule}
            description={routine.description}
            rise={getProgress(time, 0.4 + index * 0.12, 0.6)}
            spotlight={getSpotlight(time, MENTIONS, index)}
            className="w-53"
          />
        ))}
        <RoutineCard
          icon={Sparkles}
          name="your-idea"
          schedule="Whenever you like"
          description="Anything you can write as a prompt"
          rise={getProgress(time, 0.4 + HOME_ROUTINES.length * 0.12, 0.6)}
          spotlight={getSpotlight(time, MENTIONS, HOME_ROUTINES.length)}
          isDashed
          className="w-53"
        />
      </div>
    </div>
  );
}
