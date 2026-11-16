import { BadgePercent, CalendarCheck, Globe, Umbrella, type LucideIcon } from 'lucide-react';

export interface HomeRoutine {
  icon: LucideIcon;
  name: string;
  schedule: string;
  description: string;
  message: string;
}

export const HOME_ROUTINES: HomeRoutine[] = [
  {
    icon: BadgePercent,
    name: 'price-drops',
    schedule: 'Daily at 09:00',
    description: 'Checks a few shops for a discount on the headphones I want',
    message: '€239 at two shops today, 20% off',
  },
  {
    icon: CalendarCheck,
    name: 'book-haircut',
    schedule: 'Mondays at 08:00',
    description: 'Books the first free Saturday slot at my barber',
    message: 'Booked for Saturday at 10:30',
  },
  {
    icon: Umbrella,
    name: 'weather',
    schedule: 'Weekdays at 08:00',
    description: 'Says if I need an umbrella today',
    message: 'Rain from 15:00, take one',
  },
  {
    icon: Globe,
    name: 'visa-dates',
    schedule: 'Every 30 minutes',
    description: 'Checks the consulate’s website for new appointment dates',
    message: 'New dates: 4 and 5 December',
  },
];
