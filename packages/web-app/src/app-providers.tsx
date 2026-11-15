import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { Tooltip } from 'design-system/components';
import { CustomOverridesContext, type CustomOverrides } from '@web-app/contexts/custom-overrides';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

interface AppProvidersProps {
  children: ReactNode;
  overrides: CustomOverrides;
}

export function AppProviders({ children, overrides }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <CustomOverridesContext value={overrides}>
          <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
        </CustomOverridesContext>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
