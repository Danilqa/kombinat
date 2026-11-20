import { createContext, useContext, type ReactNode } from 'react';

export interface CustomRoute {
  path: string;
  element: ReactNode;
}

export interface Customization {
  announcement?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  routes?: CustomRoute[];
  routinesTitle?: string;
}

const CustomizationContext = createContext<Customization>({});

export const CustomizationProvider = CustomizationContext.Provider;

export function useCustomization(): Customization {
  return useContext(CustomizationContext);
}
