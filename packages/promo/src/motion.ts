import type { CSSProperties } from 'react';

export function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

export function easeInOutCubic(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

// How far an animation that starts at `start` and lasts `duration` seconds is at `time`, from 0 to 1.
export function getProgress(
  time: number,
  start: number,
  duration: number,
  ease: (progress: number) => number = easeOutCubic,
): number {
  if (duration <= 0) return time >= start ? 1 : 0;
  return ease(Math.min(1, Math.max(0, (time - start) / duration)));
}

export function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function toRiseStyle(progress: number, distance = 14): CSSProperties {
  return {
    opacity: progress,
    transform: `translateY(${interpolate(distance, 0, progress)}px)`,
  };
}

export function toPopStyle(progress: number): CSSProperties {
  return {
    opacity: progress,
    transform: `scale(${interpolate(0.94, 1, progress)})`,
  };
}
