import { createContext, use, type ReactNode } from 'react';

export interface CustomOverrides {
  announcement?: ReactNode;
  banner?: ReactNode;
  footer?: ReactNode;
  routinesTitle?: string;
}

export const CustomOverridesContext = createContext<CustomOverrides>({});

export function useCustomOverrides(): CustomOverrides {
  return use(CustomOverridesContext);
}
