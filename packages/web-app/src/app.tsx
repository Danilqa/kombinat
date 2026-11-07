import { useEffect, useRef } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router';
import { TooltipProvider } from 'design-system/components/tooltip';
import { PageTitle } from 'design-system/layouts/page-header';
import { AppHeader } from '@web-app/components/app-header';
import { CalendarPage } from '@web-app/features/calendar/calendar-page';
import { RoutinePage } from '@web-app/features/routines/routine-page';
import { RoutinesPage } from '@web-app/features/routines/routines-page';
import { RunPage } from '@web-app/features/runs/run-page';
import { RunsPage } from '@web-app/features/runs/runs-page';
import { useDocumentTitle } from '@web-app/hooks/use-document-title';

const MAIN_ID = 'main';

function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="flex flex-col items-center gap-1 py-16 text-center">
      <PageTitle>Page not found</PageTitle>
      <p className="text-body text-fg-muted">
        This page does not exist.{' '}
        <Link
          to="/"
          className="font-medium text-fg-secondary underline-offset-4 transition-colors hover:text-fg hover:underline"
        >
          Back to routines
        </Link>
      </p>
    </div>
  );
}

function useFocusMainOnNavigate() {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    window.scrollTo(0, 0);
    document.getElementById(MAIN_ID)?.focus({ preventScroll: true });
  }, [pathname]);
}

function AppLayout() {
  useFocusMainOnNavigate();
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
        <Routes>
          <Route path="/" element={<RoutinesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/routines/:name" element={<RoutinePage />} />
          <Route path="/runs/:routine/:id" element={<RunPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <AppLayout />
      </TooltipProvider>
    </BrowserRouter>
  );
}
