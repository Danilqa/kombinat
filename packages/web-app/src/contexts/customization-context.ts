import { createContext, type ReactNode } from 'react';

export interface Customization {
  announcement?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  routinesTitle?: string;
}

export const CustomizationContext = createContext<Customization>({});
