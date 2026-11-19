const EXCERPT_LEAD = 24;
const EXCERPT_LENGTH = 160;

function splitSearchTerms(search: string): string[] {
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term !== '');
}

export function checkMatchesSearch(search: string, texts: (string | null)[]): boolean {
  const haystack = texts.join('\n').toLowerCase();
  return splitSearchTerms(search).every(term => haystack.includes(term));
}

export function getSearchExcerpt(text: string, search: string): string | null {
  const lowerText = text.toLowerCase();
  const index = splitSearchTerms(search)
    .map(term => lowerText.indexOf(term))
    .find(termIndex => termIndex !== -1);
  if (index === undefined) return null;
  const start = Math.max(0, index - EXCERPT_LEAD);
  const excerpt = text
    .slice(start, start + EXCERPT_LENGTH)
    .replace(/\s+/g, ' ')
    .trim();
  return start > 0 ? `…${excerpt}` : excerpt;
}

export interface SearchMatch {
  start: number;
  end: number;
}

// The whole search as one phrase, as a browser's find in page does, rather than separate words.
function toSearchPattern(search: string): RegExp {
  return new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
}

export function findSearchMatches(text: string, search: string): SearchMatch[] {
  if (search === '') return [];
  return [...text.matchAll(toSearchPattern(search))].map(found => ({
    start: found.index,
    end: found.index + found[0].length,
  }));
}

export function countSearchMatches(text: string, search: string): number {
  if (search === '') return 0;
  return text.match(toSearchPattern(search))?.length ?? 0;
}
