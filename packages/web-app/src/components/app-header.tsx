import { CalendarDays, History, Workflow } from 'lucide-react';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Link, useLocation } from 'react-router';
import { BrandMark } from 'design-system/icons';
import { cn } from 'design-system/utils';
import { DaemonStatusIndicator } from 'domains/daemon/components';
import { CALENDAR_PATH, ROUTINES_PATH, RUNS_PATH } from '@web-app/constants/path';

interface NavItem {
  label: string;
  to: string;
  icon: typeof Workflow;
  checkIsActive: (pathname: string) => boolean;
}

const navItems: NavItem[] = [
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

type NavCurrent = 'page' | 'true';

// On a detail page the section link is "current" but not the current page: the breadcrumb is.
function getNavCurrent(item: NavItem, pathname: string): NavCurrent | undefined {
  if (pathname === item.to) return 'page';
  return item.checkIsActive(pathname) ? 'true' : undefined;
}

interface NavLinkItemProps {
  item: NavItem;
  pathname: string;
}

function NavLinkItem({ item, pathname }: NavLinkItemProps) {
  const Icon = item.icon;
  const isActive = item.checkIsActive(pathname);
  return (
    <Link
      to={item.to}
      aria-current={getNavCurrent(item, pathname)}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-full px-3 text-nav font-medium transition-colors forced-colors:underline-offset-4',
        isActive
          ? 'bg-overlay text-fg forced-colors:underline'
          : 'text-fg-muted hover:bg-hover hover:text-fg',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {item.label}
    </Link>
  );
}

function useHeightProperty(ref: RefObject<HTMLElement | null>, property: string) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty(property, `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(property);
    };
  }, [ref, property]);
}

export function AppHeader() {
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  useHeightProperty(headerRef, '--app-header-height');
  // On phones the brand and the status share the first row and the nav takes a row of its own.
  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 mb-6 bg-page supports-[backdrop-filter]:bg-page/70 supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150"
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-2 gap-y-2 px-4 pt-4 pb-3 sm:gap-y-3 sm:px-6 sm:pt-6 sm:pb-4">
        <Link
          to={ROUTINES_PATH}
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
        <DaemonStatusIndicator />
      </div>
    </header>
  );
}
