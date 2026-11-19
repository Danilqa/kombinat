import { useEffect } from 'react';

// Shows the count on the icon of the installed app, in the Dock, the taskbar or on the Home Screen.
export function useAppBadge(count: number | undefined) {
  useEffect(() => {
    if (count === undefined || !('setAppBadge' in navigator)) return;
    const update = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    // A browser that cannot show the badge here may reject, and then there is nothing to show.
    update.catch(() => undefined);
  }, [count]);
}
