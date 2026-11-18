import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { findSearchMatches } from 'utils/search';

const MATCH_HIGHLIGHT = 'search-match';
const CURRENT_HIGHLIGHT = 'search-match-current';
// Collapsibles that a new search opens or closes animate their height for 200ms, and scrolling to a
// match inside one before it ends would scroll its clipped content instead of the page.
const SETTLE_MS = 250;
const SKIPPED_TEXT_SELECTOR =
  '.sr-only, [data-search-skip], [data-slot="collapsible-content"][data-state="closed"]';

function findTextRanges(container: HTMLElement, search: string): Range[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const ranges: Range[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.parentElement?.closest(SKIPPED_TEXT_SELECTOR)) continue;
    for (const { start, end } of findSearchMatches(node.textContent ?? '', search)) {
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  return ranges;
}

function scrollToRange(range: Range | undefined) {
  range?.startContainer.parentElement?.scrollIntoView({ block: 'center' });
}

export interface TextSearch {
  count: number;
  current: number;
  move: (step: 1 | -1) => void;
}

// Finds the search in the text the container shows and highlights it, as a browser's find in page.
export function useTextSearch(
  containerRef: RefObject<HTMLElement | null>,
  search: string,
): TextSearch {
  const [ranges, setRanges] = useState<Range[]>([]);
  const [current, setCurrent] = useState(0);
  const rangesRef = useRef(ranges);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const index = Math.min(current, Math.max(0, ranges.length - 1));

  useEffect(() => {
    const container = containerRef.current;
    const update = () => {
      rangesRef.current = container && search !== '' ? findTextRanges(container, search) : [];
      setRanges(rangesRef.current);
    };
    update();
    setCurrent(0);
    if (!container || search === '') return;
    // Events arrive and tool calls open while the search stays, so it follows the text.
    const observer = new MutationObserver(update);
    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
      attributeFilter: ['data-state'],
    });
    settleTimeoutRef.current = setTimeout(() => scrollToRange(rangesRef.current[0]), SETTLE_MS);
    return () => {
      observer.disconnect();
      clearTimeout(settleTimeoutRef.current);
    };
  }, [containerRef, search]);

  useEffect(() => {
    if (!('highlights' in CSS)) return;
    CSS.highlights.set(MATCH_HIGHLIGHT, new Highlight(...ranges));
    const currentRange = ranges[index];
    if (currentRange) CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(currentRange));
    return () => {
      CSS.highlights.delete(MATCH_HIGHLIGHT);
      CSS.highlights.delete(CURRENT_HIGHLIGHT);
    };
  }, [ranges, index]);

  const move = useCallback(
    (step: 1 | -1) => {
      if (ranges.length === 0) return;
      clearTimeout(settleTimeoutRef.current);
      const next = (index + step + ranges.length) % ranges.length;
      setCurrent(next);
      scrollToRange(ranges[next]);
    },
    [ranges, index],
  );

  return { count: ranges.length, current: index, move };
}
