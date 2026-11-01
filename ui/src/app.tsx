import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { Breadcrumbs } from '@/components/page-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RoutinePage } from '@/pages/routine-page';
import { RoutinesPage } from '@/pages/routines-page';
import { RunPage } from '@/pages/run-page';

function NotFoundPage() {
  return (
    <div>
      <Breadcrumbs crumbs={[]} />
      <div className="flex flex-col items-center gap-1 py-16 text-center">
        <p className="text-title-sm text-fg">Page not found</p>
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
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <main className="mx-auto max-w-[1180px] px-6 pt-6 pb-20">
          <Routes>
            <Route path="/" element={<RoutinesPage />} />
            <Route path="/routines/:name" element={<RoutinePage />} />
            <Route path="/runs/:routine/:id" element={<RunPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </TooltipProvider>
    </BrowserRouter>
  );
}
