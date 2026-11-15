import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { Tooltip } from 'design-system/components';
import { CustomizationProvider, type Customization } from '@web-app/contexts';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

interface AppProvidersProps {
  children: ReactNode;
  customization: Customization;
}

export function AppProviders({ children, customization }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <CustomizationProvider value={customization}>
          <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
        </CustomizationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
