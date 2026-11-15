import { createContext, use } from 'react';

export interface CustomOverrides {
  routinesTitle?: string;
}

export const CustomOverridesContext = createContext<CustomOverrides>({});

export function useCustomOverrides(): CustomOverrides {
  return use(CustomOverridesContext);
}
