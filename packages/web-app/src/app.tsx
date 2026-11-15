import { useLocation } from 'react-router';
import { AppProviders } from '@web-app/app-providers';
import { AppRoutes } from '@web-app/app-routes';
import { AppFooter } from '@web-app/components/app-footer';
import { AppHeader } from '@web-app/components/app-header';
import { useCustomOverrides, type CustomOverrides } from '@web-app/contexts/custom-overrides';
import { useFocusMainOnNavigate } from '@web-app/hooks/use-focus-main-on-navigate';

const MAIN_ID = 'main';

function AppLayout() {
  const { announcement, banner, footer = <AppFooter /> } = useCustomOverrides();
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
    </div>
  );
}

interface AppProps {
  overrides?: CustomOverrides;
}

export function App({ overrides = {} }: AppProps) {
  return (
    <AppProviders overrides={overrides}>
      <AppLayout />
    </AppProviders>
  );
}
