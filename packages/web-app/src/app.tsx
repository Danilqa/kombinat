import type { ReactNode } from 'react';
import { AppProviders } from '@web-app/app-providers';
import { AppRoutes } from '@web-app/app-routes';
import { AppFooter } from '@web-app/components/app-footer';
import { AppHeader } from '@web-app/components/app-header';
import { useFocusMainOnNavigate } from '@web-app/hooks/use-focus-main-on-navigate';

const MAIN_ID = 'main';

interface AppLayoutProps {
  announcement: ReactNode;
  banner: ReactNode;
  footer: ReactNode;
}

function AppLayout({ announcement, banner, footer }: AppLayoutProps) {
  useFocusMainOnNavigate(MAIN_ID);
  return (
    <>
      <div className="pb-20">
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
          <AppRoutes />
        </main>
      </div>
      {footer}
    </>
  );
}

interface AppProps {
  announcement?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
}

export function App({ announcement, banner, footer = <AppFooter /> }: AppProps) {
  return (
    <AppProviders>
      <AppLayout announcement={announcement} banner={banner} footer={footer} />
    </AppProviders>
  );
}
