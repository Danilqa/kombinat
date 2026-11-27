import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { match } from 'ts-pattern';
import { checkPrefersReducedMotion } from 'design-system';

const SETTLE_DELAY_MS = 150;
const WHEEL_RELEASE_MS = 120;
const WHEEL_STEP_SHARE = 0.15;
const WHEEL_LINE_PX = 16;

export type StepDirection = -1 | 1;

function getScrollBehavior(): ScrollBehavior {
  return checkPrefersReducedMotion() ? 'instant' : 'smooth';
}

function getWheelDeltaX(event: WheelEvent, pageWidth: number): number {
  const delta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
  return match(event.deltaMode)
    .with(WheelEvent.DOM_DELTA_LINE, () => delta * WHEEL_LINE_PX)
    .with(WheelEvent.DOM_DELTA_PAGE, () => delta * pageWidth)
    .otherwise(() => delta);
}

interface SwipePanels {
  scrollerRef: RefObject<HTMLDivElement | null>;
  headerTrackRef: RefObject<HTMLDivElement | null>;
  preview: number;
  slide: (direction: StepDirection, behavior?: ScrollBehavior) => void;
}

// Once scrolling stops, the period moves to the panel in view and the scroller recentres in one frame.
export function useSwipePanels(
  periodKey: string,
  radius: number,
  onStep: (steps: number) => void,
): SwipePanels {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const headerTrackRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(0);
  const onStepRef = useRef(onStep);
  const settleRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    onStepRef.current = onStep;
  });

  const syncHeader = useCallback(() => {
    const scroller = scrollerRef.current;
    const track = headerTrackRef.current;
    if (scroller && track) track.style.translate = `${-scroller.scrollLeft}px 0`;
  }, []);

  const recentre = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    scroller.scrollLeft = scroller.clientWidth * radius;
    syncHeader();
  }, [radius, syncHeader]);

  useLayoutEffect(recentre, [periodKey, recentre]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    let isWheeling = false;
    let isTouching = false;
    let shownPreview = 0;
    const getPanelOffset = () => {
      const width = scroller.clientWidth;
      return width === 0 ? 0 : scroller.scrollLeft / width - radius;
    };
    const updatePreview = () => {
      const next = Math.max(-radius, Math.min(radius, Math.round(getPanelOffset())));
      if (next === shownPreview) return;
      shownPreview = next;
      setPreview(next);
    };
    const settle = () => {
      clearTimeout(timer);
      if (isWheeling || isTouching) return;
      const offset = getPanelOffset();
      const steps = Math.round(offset);
      if (steps === 0 || Math.abs(offset - steps) * scroller.clientWidth > 1) return;
      flushSync(() => {
        onStepRef.current(steps);
        setPreview(0);
      });
      shownPreview = 0;
      recentre();
    };
    // Safari before 26 has no scrollend, so a pause in scrolling counts as the end too.
    const scheduleSettle = () => {
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_DELAY_MS);
    };
    const handleScroll = () => {
      syncHeader();
      updatePreview();
      scheduleSettle();
    };
    const handleTouchStart = () => {
      isTouching = true;
      clearTimeout(timer);
    };
    const handleTouchEnd = () => {
      isTouching = false;
      scheduleSettle();
    };
    // Snapping would undo every mouse wheel notch, so the wheel moves the panels until it stops.
    const releaseWheel = () => {
      isWheeling = false;
      const offset = getPanelOffset();
      const direction = Math.abs(offset) > WHEEL_STEP_SHARE ? Math.sign(offset) : 0;
      const target = scroller.clientWidth * (radius + direction);
      scroller.style.scrollSnapType = '';
      if (Math.abs(scroller.scrollLeft - target) <= 1) settle();
      else scroller.scrollTo({ left: target, behavior: getScrollBehavior() });
    };
    const handleWheel = (event: WheelEvent) => {
      const width = scroller.clientWidth;
      const deltaX = getWheelDeltaX(event, width);
      if (Math.abs(deltaX) <= Math.abs(event.shiftKey ? 0 : event.deltaY)) return;
      event.preventDefault();
      isWheeling = true;
      scroller.style.scrollSnapType = 'none';
      const centre = width * radius;
      scroller.scrollLeft = Math.min(
        Math.max(scroller.scrollLeft + deltaX, centre - width),
        centre + width,
      );
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(releaseWheel, WHEEL_RELEASE_MS);
    };
    const resizeObserver = new ResizeObserver(recentre);
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    scroller.addEventListener('scrollend', settle);
    scroller.addEventListener('wheel', handleWheel, { passive: false });
    scroller.addEventListener('touchstart', handleTouchStart, { passive: true });
    scroller.addEventListener('touchend', handleTouchEnd, { passive: true });
    scroller.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    resizeObserver.observe(scroller);
    settleRef.current = settle;
    return () => {
      clearTimeout(timer);
      clearTimeout(wheelTimer);
      scroller.removeEventListener('scroll', handleScroll);
      scroller.removeEventListener('scrollend', settle);
      scroller.removeEventListener('wheel', handleWheel);
      scroller.removeEventListener('touchstart', handleTouchStart);
      scroller.removeEventListener('touchend', handleTouchEnd);
      scroller.removeEventListener('touchcancel', handleTouchEnd);
      resizeObserver.disconnect();
    };
  }, [radius, recentre, syncHeader]);

  // Commits a finished slide first, or its pending settle would undo this one.
  const slide = useCallback(
    (direction: StepDirection, behavior: ScrollBehavior = getScrollBehavior()) => {
      const scroller = scrollerRef.current;
      if (scroller === null || scroller.clientWidth === 0) return;
      settleRef.current();
      const inView = Math.round(scroller.scrollLeft / scroller.clientWidth);
      const target = Math.max(0, Math.min(radius * 2, inView + direction));
      scroller.scrollTo({ left: scroller.clientWidth * target, behavior });
    },
    [radius],
  );

  return { scrollerRef, headerTrackRef, preview, slide };
}
