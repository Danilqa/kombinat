import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RoutinePage } from '@/pages/routine-page';
import { RoutinesPage } from '@/pages/routines-page';
import { RunPage } from '@/pages/run-page';

function NotFoundPage() {
  return (
    <div className="py-10 text-center text-paragraph-14 text-grey-70">
      Page not found.{' '}
      <Link to="/" className="font-semibold text-black hover:underline">
        Back to routines
      </Link>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <main className="mx-auto max-w-[1180px] px-8 pt-10 pb-16">
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
