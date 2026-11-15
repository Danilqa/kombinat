import { clsx, type ClassValue } from 'clsx';
import { useEffect, useState } from 'react';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      ease: ['out-quint'],
    },
    classGroups: {
      'font-size': [
        {
          text: ['title-lg', 'title-md', 'title-sm', 'body', 'body-sm', 'caption', 'nav', 'nav-sm'],
        },
      ],
      shadow: [{ shadow: ['popover', 'focus'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

export function checkPrefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
