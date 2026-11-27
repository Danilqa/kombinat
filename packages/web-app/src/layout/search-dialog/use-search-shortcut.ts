import { useEffect } from 'react';
import { isApplePlatform } from '@web-app/hooks';

export const SEARCH_SHORTCUT_LABEL = isApplePlatform ? '⌘K' : 'Ctrl K';
export const SEARCH_SHORTCUT_ARIA = isApplePlatform ? 'Meta+K' : 'Control+K';

function checkIsSearchShortcut(event: KeyboardEvent): boolean {
  const hasModifier = event.metaKey || event.ctrlKey;
  return hasModifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
}

export function useSearchShortcut(toggle: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!checkIsSearchShortcut(event)) return;
      // Firefox and Chrome on Windows would focus their own search bar.
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
}
