import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { TooltipProvider } from 'design-system/components/tooltip';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </BrowserRouter>
  );
}
