import { clsx, type ClassValue } from 'clsx';
import { useEffect, useState, useSyncExternalStore } from 'react';
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

const CLOCK_TICK_MS = 1000;

const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | undefined;
let clockNow = Date.now();

function subscribeToClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (clockTimer === undefined) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const clockListener of clockListeners) clockListener();
    }, CLOCK_TICK_MS);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size > 0) return;
    clearInterval(clockTimer);
    clockTimer = undefined;
  };
}

function getClockNow(): number {
  return clockTimer === undefined ? Date.now() : clockNow;
}

// The clock ticks every second, but a component re-renders only when its text changes.
export function useLiveText(format: (now: number) => string): string {
  return useSyncExternalStore(subscribeToClock, () => format(getClockNow()));
}
