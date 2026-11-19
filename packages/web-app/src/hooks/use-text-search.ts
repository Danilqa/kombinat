import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { findSearchMatches } from 'utils/search';

const MATCH_HIGHLIGHT = 'search-match';
const CURRENT_HIGHLIGHT = 'search-match-current';
// Collapsibles that a search opens animate their height for 200ms, and scrolling to a match inside
// one before it ends would scroll its clipped content instead of the page.
const SETTLE_MS = 250;
const SKIPPED_SELECTOR = '.sr-only, [data-search-skip]';
const CLOSED_SELECTOR = '[data-slot="collapsible-content"][data-state="closed"]';

// A match in a closed collapsible, which counts it in `data-search-matches` without showing it.
interface HiddenMatch {
  element: HTMLElement;
}

type TextMatch = Range | HiddenMatch;

function findTextMatches(container: HTMLElement, search: string): TextMatch[] {
  const matches: TextMatch[] = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        if (node instanceof Text) return NodeFilter.FILTER_ACCEPT;
        if (!(node instanceof HTMLElement) || node.matches(SKIPPED_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.matches(CLOSED_SELECTOR)) return NodeFilter.FILTER_SKIP;
        const hiddenMatch = { element: node };
        const count = Number(node.dataset['searchMatches'] ?? 0);
        for (let index = 0; index < count; index++) matches.push(hiddenMatch);
        return NodeFilter.FILTER_REJECT;
      },
    },
  );
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    for (const { start, end } of findSearchMatches(node.textContent ?? '', search)) {
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      matches.push(range);
    }
  }
  return matches;
}

// Opens only the collapsible of the current match, as a browser does with a closed <details>.
function revealMatch(match: TextMatch | undefined) {
  if (match === undefined || match instanceof Range || !match.element.matches(CLOSED_SELECTOR)) {
    return;
  }
  match.element
    .closest('[data-slot="collapsible"]')
    ?.querySelector<HTMLElement>(':scope > [data-slot="collapsible-trigger"]')
    ?.click();
}

function scrollToMatch(match: TextMatch | undefined) {
  if (!(match instanceof Range)) return;
  const element = match.startContainer.parentElement;
  if (!element) return;
  element.scrollIntoView({ block: 'center' });
  // A long tool result scrolls in its own box, and scrollIntoView moves only the page to that box.
  if (element.scrollHeight > element.clientHeight) {
    const offset = match.getBoundingClientRect().top - element.getBoundingClientRect().top;
    element.scrollTop += offset - element.clientHeight / 2;
  }
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
  const [matches, setMatches] = useState<TextMatch[]>([]);
  const [current, setCurrent] = useState(0);
  const matchesRef = useRef(matches);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const index = Math.min(current, Math.max(0, matches.length - 1));

  const showMatch = useCallback((matchIndex: number) => {
    clearTimeout(settleTimeoutRef.current);
    const match = matchesRef.current[matchIndex];
    if (match instanceof Range) {
      scrollToMatch(match);
      return;
    }
    revealMatch(match);
    settleTimeoutRef.current = setTimeout(
      () => scrollToMatch(matchesRef.current[matchIndex]),
      SETTLE_MS,
    );
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const update = () => {
      matchesRef.current = container && search !== '' ? findTextMatches(container, search) : [];
      setMatches(matchesRef.current);
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
      attributeFilter: ['data-state', 'data-search-matches'],
    });
    showMatch(0);
    return () => {
      observer.disconnect();
      clearTimeout(settleTimeoutRef.current);
    };
  }, [containerRef, search, showMatch]);

  useEffect(() => {
    if (!('highlights' in CSS)) return;
    // Spreading the ranges into the constructor overflows the call stack past about 100k matches.
    const highlight = new Highlight();
    for (const match of matches) if (match instanceof Range) highlight.add(match);
    CSS.highlights.set(MATCH_HIGHLIGHT, highlight);
    const currentMatch = matches[index];
    if (currentMatch instanceof Range) {
      CSS.highlights.set(CURRENT_HIGHLIGHT, new Highlight(currentMatch));
    }
    return () => {
      CSS.highlights.delete(MATCH_HIGHLIGHT);
      CSS.highlights.delete(CURRENT_HIGHLIGHT);
    };
  }, [matches, index]);

  const move = useCallback(
    (step: 1 | -1) => {
      if (matches.length === 0) return;
      const next = (index + step + matches.length) % matches.length;
      setCurrent(next);
      showMatch(next);
    },
    [matches.length, index, showMatch],
  );

  return { count: matches.length, current: index, move };
}
