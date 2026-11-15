import { createContext, useContext, type ReactNode } from 'react';

export interface Customization {
  announcement?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  routinesTitle?: string;
}

const CustomizationContext = createContext<Customization>({});

export const CustomizationProvider = CustomizationContext.Provider;

export function useCustomization(): Customization {
  return useContext(CustomizationContext);
}
