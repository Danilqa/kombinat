import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { Tooltip } from 'design-system/components';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
