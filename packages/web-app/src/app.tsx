import { useLocation } from 'react-router';
import { UpdateCard } from 'domains/release/components';
import { AppProviders } from '@web-app/app-providers';
import { AppRoutes } from '@web-app/app-routes';
import { AppFooter } from '@web-app/components/app-footer';
import { AppHeader } from '@web-app/components/app-header';
import { useCustomization, type Customization } from '@web-app/contexts';
import { useFocusMainOnNavigate } from '@web-app/hooks/use-focus-main-on-navigate';

const MAIN_ID = 'main';

function AppLayout() {
  const { announcement, banner, footer = <AppFooter /> } = useCustomization();
  useFocusMainOnNavigate(MAIN_ID);
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col">
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
          className="mx-auto max-w-[1180px] px-4 outline-none focus-visible:shadow-none sm:px-6"
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
