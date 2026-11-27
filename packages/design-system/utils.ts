import { clsx, type ClassValue } from 'clsx';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import { extendTailwindMerge } from 'tailwind-merge';

// Without its name here, tailwind-merge takes a custom class for a colour or does not know it at
// all, and keeps both of two classes that set the same property.
const twMerge = extendTailwindMerge({
  extend: {
    // The custom keys of each @theme namespace in the stylesheets.
    theme: {
      animate: [
        'soft-pulse',
        'smoke-drift',
        'status-pop',
        'worker-peek-up',
        'worker-peek-left',
        'worker-peek-right',
        'worker-pop',
        'title-flow',
        'glow-orbit',
        'glow-orbit-offset',
      ],
      container: ['page'],
      ease: ['out-quint'],
      shadow: [
        'popover',
        'focus',
        'stripe-positive',
        'stripe-negative',
        'stripe-warning',
        'stripe-info',
        'stripe-neutral',
        'outline-negative',
      ],
      text: ['title-lg', 'title-md', 'title-sm', 'body', 'body-sm', 'caption', 'nav', 'nav-sm'],
    },
    // The @utility classes of the stylesheet and of tw-animate-css.
    classGroups: {
      animate: [{ animate: ['in', 'out'] }],
      top: [{ top: ['below-page-header', 'below-headers'] }],
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

function getRoot(): HTMLElement {
  return document.documentElement;
}

// Sticky parts read the heights of the sticky headers above them from these custom properties.
export function useHeightProperty(
  ref: RefObject<HTMLElement | null>,
  property: string,
  getTarget: (element: HTMLElement) => HTMLElement | null = getRoot,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    const target = element && getTarget(element);
    if (!element || !target) return;
    const update = () => target.style.setProperty(property, `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      target.style.removeProperty(property);
    };
  }, [ref, property, getTarget]);
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

// The clock ticks every second, but a component re-renders only when its value changes.
export function useLiveValue<T extends string | boolean>(read: (now: number) => T): T {
  return useSyncExternalStore(subscribeToClock, () => read(getClockNow()));
}

export function useLiveText(format: (now: number) => string): string {
  return useLiveValue(format);
}
