import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { Tooltip } from 'design-system/components';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
      <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
    </BrowserRouter>
  );
}
