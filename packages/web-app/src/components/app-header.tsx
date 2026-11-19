import { Search } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button, Kbd, SlidingPill } from 'design-system/components';
import { BrandMark } from 'design-system/icons';
import { cn, useHeightProperty } from 'design-system/utils';
import { DaemonStatusIndicator } from 'domains/daemon/components';
import { navItems, type NavItem } from '@web-app/constants/nav-items';
import { INBOX_PATH, ROUTINES_PATH } from '@web-app/constants/path';
import { useInbox } from '@web-app/hooks/use-inbox';
import {
  SEARCH_SHORTCUT_ARIA,
  SEARCH_SHORTCUT_LABEL,
  useSearchShortcut,
} from '@web-app/hooks/use-search-shortcut';
import { SearchDialog } from '@web-app/components/search-dialog';

type NavCurrent = 'page' | 'true';

// On a detail page the section link is "current" but not the current page: the breadcrumb is.
function getNavCurrent(item: NavItem, pathname: string): NavCurrent | undefined {
  if (pathname === item.to) return 'page';
  return item.checkIsActive(pathname) ? 'true' : undefined;
}

interface NavLinkItemProps {
  item: NavItem;
  pathname: string;
  unreadCount: number;
}

function NavLinkItem({ item, pathname, unreadCount }: NavLinkItemProps) {
  const Icon = item.icon;
  const isActive = item.checkIsActive(pathname);
  return (
    <Link
      to={item.to}
      aria-current={getNavCurrent(item, pathname)}
      data-active={isActive || undefined}
      className={cn(
        'relative flex h-8 items-center gap-1.5 rounded-full px-3 text-nav max-sm:px-2 font-medium transition-[color,background-color,scale] duration-150 active:scale-[0.97] forced-colors:underline-offset-4',
        isActive ? 'text-fg forced-colors:underline' : 'text-fg-muted hover:bg-hover hover:text-fg',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0 max-sm:hidden" />
      {item.label}
      {unreadCount > 0 && (
        <span className="ml-0.5 min-w-4.5 animate-in rounded-full bg-fg px-1.5 text-center text-caption leading-4.5 text-page tabular-nums duration-200 zoom-in-90 fade-in">
          {unreadCount}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </Link>
  );
}

export function AppHeader() {
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const unreadCount = useInbox().data?.runs.length ?? 0;
  useHeightProperty(headerRef, '--app-header-height');
  useSearchShortcut(() => setIsSearchOpen(isOpen => !isOpen));
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
        <nav aria-label="Main" className="relative max-sm:order-last max-sm:w-full">
          <SlidingPill activeSelector="[data-active]" />
          <ul className="flex items-center gap-1">
            {navItems.map(item => (
              <li key={item.to}>
                <NavLinkItem
                  item={item}
                  pathname={pathname}
                  unreadCount={item.to === INBOX_PATH ? unreadCount : 0}
                />
              </li>
            ))}
          </ul>
        </nav>
        <Button
          variant="tertiary"
          size="small"
          aria-label="Search"
          aria-keyshortcuts={SEARCH_SHORTCUT_ARIA}
          className="max-sm:size-8 max-sm:px-0"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search aria-hidden="true" />
          <Kbd aria-hidden="true" className="max-sm:hidden">
            {SEARCH_SHORTCUT_LABEL}
          </Kbd>
        </Button>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-line-strong max-sm:hidden" />
        <DaemonStatusIndicator />
      </div>
      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </header>
  );
}
