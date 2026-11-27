import {
  Accessibility,
  Activity,
  Bug,
  FlaskConical,
  Megaphone,
  MessagesSquare,
  Palette,
  Siren,
  type LucideIcon,
} from 'lucide-react';
import { RoutineCard } from '../../routine-card';
import { SceneHeading } from '../../heading';
import { getProgress, getSpotlight } from '../../motion';

interface WorkRoutine {
  icon: LucideIcon;
  name: string;
  schedule: string;
  description: string;
  // When the voiceover names it, in seconds since the scene started.
  mentionedAt: number;
}

const WORK_ROUTINES: WorkRoutine[] = [
  {
    icon: Siren,
    name: 'on-call-engineer',
    schedule: 'On every alert',
    description: 'Finds the cause of a production incident and proposes a fix',
    mentionedAt: 1.45,
  },
  {
    icon: Activity,
    name: 'release-monitoring',
    schedule: 'Daily at 10:00 and 16:00',
    description: 'Watches what shipped and fixes regressions',
    mentionedAt: 2.35,
  },
  {
    icon: Bug,
    name: 'bug-fix-pickup',
    schedule: 'Daily at 11:30',
    description: 'Fixes the oldest bug and opens a pull request',
    mentionedAt: 3.85,
  },
  {
    icon: FlaskConical,
    name: 'flaky-e2e-fixer',
    schedule: 'Weekdays at 07:00',
    description: 'Finds flaky end-to-end tests and fixes them',
    mentionedAt: 3.85,
  },
  {
    icon: Palette,
    name: 'design-ux-issues',
    schedule: 'Nightly at 03:30',
    description: 'Clicks through the app and files design issues',
    mentionedAt: 5.05,
  },
  {
    icon: Accessibility,
    name: 'accessibility-audit',
    schedule: 'Weekly on Monday',
    description: 'Checks new pages for accessibility problems',
    mentionedAt: 5.05,
  },
  {
    icon: Megaphone,
    name: 'gtm-lead-research',
    schedule: 'Daily at 08:00',
    description: 'Researches new sign-ups and drafts outreach',
    mentionedAt: 7.5,
  },
  {
    icon: MessagesSquare,
    name: 'support-signals',
    schedule: 'Daily at 18:00',
    description: 'Turns the day’s support chats into product signals',
    mentionedAt: 8.9,
  },
];

const MENTIONS = WORK_ROUTINES.map(routine => routine.mentionedAt);

interface WorkSceneProps {
  time: number;
}

export function WorkScene({ time }: WorkSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 pb-4">
      <SceneHeading
        time={time}
        title="Hand off your team’s"
        accent="routine work"
        subtitle="A few of the routines teams run with Kombinat."
      />
      <div className="grid grid-cols-4 gap-4">
        {WORK_ROUTINES.map((routine, index) => (
          <RoutineCard
            key={routine.name}
            icon={routine.icon}
            name={routine.name}
            schedule={routine.schedule}
            description={routine.description}
            rise={getProgress(time, 0.4 + index * 0.08, 0.6)}
            spotlight={getSpotlight(time, MENTIONS, index)}
            className="w-68"
          />
        ))}
      </div>
    </div>
  );
}
