import { useLocation } from 'react-router';
import { AppProviders } from '@web-app/app-providers';
import { AppRoutes } from '@web-app/app-routes';
import { useCustomization, type Customization } from '@web-app/customization';
import { useLiveUpdates } from '@web-app/domains/daemon/queries';
import { useInbox } from '@web-app/domains/inbox/queries';
import { useRunNotifications } from '@web-app/domains/inbox/use-run-notifications';
import { UpdateCard } from '@web-app/domains/release/update-card';
import { useAppBadge } from '@web-app/hooks/use-app-badge';
import { useFocusMainOnNavigate } from '@web-app/hooks/use-focus-main-on-navigate';
import { AppFooter } from '@web-app/layout/app-footer';
import { AppHeader } from '@web-app/layout/app-header';

const MAIN_ID = 'main';

function AppLayout() {
  const { announcement, banner, footer = <AppFooter /> } = useCustomization();
  useFocusMainOnNavigate(MAIN_ID);
  useLiveUpdates();
  useAppBadge(useInbox().data?.runs.length);
  useRunNotifications();
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="flex-1 pb-20">
        <a href={`#${MAIN_ID}`} className="skip-link">
          Skip to content
        </a>
        {announcement}
        <AppHeader />
        {banner}
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="mx-auto max-w-page px-4 outline-none focus-visible:shadow-none sm:px-6"
        >
          <div key={pathname} className="animate-in duration-150 ease-out-quint fade-in">
            <AppRoutes />
          </div>
        </main>
      </div>
      {footer}
      <UpdateCard />
    </div>
  );
}

interface AppProps {
  customization?: Customization;
}

export function App({ customization = {} }: AppProps) {
  return (
    <AppProviders customization={customization}>
      <AppLayout />
    </AppProviders>
  );
}
