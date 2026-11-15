import { CalendarDays, History, Workflow } from 'lucide-react';

import { CALENDAR_PATH, ROUTINES_PATH, RUNS_PATH } from '@web-app/constants/path';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof Workflow;
  checkIsActive: (pathname: string) => boolean;
}

export const navItems: NavItem[] = [
  {
    label: 'Routines',
    to: ROUTINES_PATH,
    icon: Workflow,
    checkIsActive: pathname => pathname === ROUTINES_PATH || pathname.startsWith('/routines/'),
  },
  {
    label: 'Calendar',
    to: CALENDAR_PATH,
    icon: CalendarDays,
    checkIsActive: pathname => pathname.startsWith(CALENDAR_PATH),
  },
  {
    label: 'Runs',
    to: RUNS_PATH,
    icon: History,
    checkIsActive: pathname => pathname.startsWith(RUNS_PATH),
  },
];
