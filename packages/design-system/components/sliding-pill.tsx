import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../utils';

interface PillBox {
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
}

const ACTIVE_ATTRIBUTES = ['data-active', 'data-state', 'aria-current', 'aria-selected'];

function checkIsSameBox(a: PillBox, b: PillBox): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.isVisible === b.isVisible
  );
}

// The pill animates only after the first paint, so a page load does not slide it in.
function useIsAfterFirstPaint(): boolean {
  const [isAfterFirstPaint, setIsAfterFirstPaint] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsAfterFirstPaint(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return isAfterFirstPaint;
}

interface SlidingPillProps {
  activeSelector: string;
  className?: string;
}

// Slides behind the item of its parent that matches activeSelector. The parent must be positioned
// and its items must be positioned too, so they paint above the pill. Without an active item the
// pill fades out where it was.
export function SlidingPill({ activeSelector, className }: SlidingPillProps) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<PillBox>({ x: 0, y: 0, width: 0, height: 0, isVisible: false });
  const isAfterFirstPaint = useIsAfterFirstPaint();

  useLayoutEffect(() => {
    const container = pillRef.current?.parentElement;
    if (!container) return;
    const update = () => {
      const active = container.querySelector(activeSelector);
      setBox(previous => {
        if (active === null)
          return previous.isVisible ? { ...previous, isVisible: false } : previous;
        const containerRect = container.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        const next = {
          x: activeRect.left - containerRect.left,
          y: activeRect.top - containerRect.top,
          width: activeRect.width,
          height: activeRect.height,
          isVisible: true,
        };
        return checkIsSameBox(previous, next) ? previous : next;
      });
    };
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);
    for (const item of container.children) {
      if (item !== pillRef.current) resizeObserver.observe(item);
    }
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ACTIVE_ATTRIBUTES,
    });
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [activeSelector]);

  return (
    <span
      ref={pillRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-0 left-0 rounded-full bg-overlay',
        isAfterFirstPaint &&
          'transition-[translate,width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        !box.isVisible && 'opacity-0',
        className,
      )}
      style={{ width: box.width, height: box.height, translate: `${box.x}px ${box.y}px` }}
    />
  );
}
