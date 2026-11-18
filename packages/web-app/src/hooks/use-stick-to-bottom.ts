import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const NEAR_BOTTOM_PX = 120;

function checkIsNearBottom(): boolean {
  return (
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX
  );
}

// Keeps the window at the bottom as the content grows, unless the reader scrolled up.
export function useStickToBottom(contentKey: unknown): () => void {
  const isStuckRef = useRef(checkIsNearBottom());
  const previousKeyRef = useRef(contentKey);

  useEffect(() => {
    const update = () => {
      isStuckRef.current = checkIsNearBottom();
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useLayoutEffect(() => {
    if (previousKeyRef.current === contentKey) return;
    previousKeyRef.current = contentKey;
    if (isStuckRef.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [contentKey]);

  return useCallback(() => {
    isStuckRef.current = true;
  }, []);
}
