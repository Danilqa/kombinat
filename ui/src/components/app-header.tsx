import { CalendarDays, History, Workflow } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { BrandMark } from '@/components/brand-mark';
import { DaemonStatus } from '@/components/daemon-status';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: typeof Workflow;
  getIsActive: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Routines',
    to: '/',
    icon: Workflow,
    getIsActive: pathname => pathname === '/' || pathname.startsWith('/routines/'),
  },
  {
    label: 'Calendar',
    to: '/calendar',
    icon: CalendarDays,
    getIsActive: pathname => pathname.startsWith('/calendar'),
  },
  {
    label: 'Runs',
    to: '/runs',
    icon: History,
    getIsActive: pathname => pathname.startsWith('/runs'),
  },
];

type NavCurrent = 'page' | 'true';

// On a detail page the section link is "current" but not the current page: the breadcrumb is.
function getNavCurrent(item: NavItem, pathname: string): NavCurrent | undefined {
  if (pathname === item.to) return 'page';
  return item.getIsActive(pathname) ? 'true' : undefined;
}

interface NavLinkItemProps {
  item: NavItem;
  pathname: string;
}

function NavLinkItem({ item, pathname }: NavLinkItemProps) {
  const Icon = item.icon;
  const isActive = item.getIsActive(pathname);
  return (
    <Link
      to={item.to}
      aria-current={getNavCurrent(item, pathname)}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-full px-3 text-body font-medium transition-colors forced-colors:underline-offset-4',
        isActive
          ? 'bg-overlay text-fg forced-colors:underline'
          : 'text-fg-muted hover:bg-hover hover:text-fg',
      )}
    >
      {/* Below 360px the three links only fit as words. */}
      <Icon aria-hidden="true" className="size-3.5 shrink-0 max-[360px]:hidden" />
      {item.label}
    </Link>
  );
}

export function AppHeader() {
  const { pathname } = useLocation();
  // On phones the brand and the status share the first row and the nav takes a row of its own.
  return (
    <header className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-3">
      <Link
        to="/"
        className="mr-auto flex shrink-0 items-center gap-2 rounded-md text-title-md text-fg"
      >
        <BrandMark />
        Kombinat
      </Link>
      <nav aria-label="Main" className="max-sm:order-last max-sm:w-full">
        <ul className="flex items-center gap-1">
          {navItems.map(item => (
            <li key={item.to}>
              <NavLinkItem item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-line-strong max-sm:hidden" />
      <DaemonStatus />
    </header>
  );
}
