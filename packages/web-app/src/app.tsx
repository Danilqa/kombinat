import { AppProviders } from '@web-app/app-providers';
import { AppRoutes } from '@web-app/app-routes';
import { AppHeader } from '@web-app/components/app-header';
import { useFocusMainOnNavigate } from '@web-app/hooks/use-focus-main-on-navigate';

const MAIN_ID = 'main';

function AppLayout() {
  useFocusMainOnNavigate(MAIN_ID);
  return (
    <div className="pb-20">
      <a href={`#${MAIN_ID}`} className="skip-link">
        Skip to content
      </a>
      <AppHeader />
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="mx-auto max-w-[1180px] px-4 outline-none focus-visible:shadow-none sm:px-6"
      >
        <AppRoutes />
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
}
