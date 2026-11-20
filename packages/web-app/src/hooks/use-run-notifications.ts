import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router';
import { isMatching } from 'ts-pattern';

import type { RunNotification } from 'domains/inbox/types';
import { buildRunNotifications, listRunsToNotify } from 'domains/inbox/utils';
import type { RunRecord } from 'domains/run/types';
import { getRunPath, INBOX_PATH } from '@web-app/constants/path';
import { useInbox } from '@web-app/hooks/use-inbox';
import { readNotificationAccess } from '@web-app/hooks/use-notification-permission';

function toNotificationPath({ run }: RunNotification): string {
  return run === null ? INBOX_PATH : getRunPath(run.routine, run.id);
}

async function showNotification(notification: RunNotification, navigate: NavigateFunction) {
  const path = toNotificationPath(notification);
  const icon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href;
  const options: NotificationOptions = {
    body: notification.body,
    // Each open tab shows it, and the same tag makes them one.
    tag: path,
    data: { url: new URL(path.slice(1), new URL(import.meta.env.BASE_URL, location.origin)).href },
    ...(icon !== undefined && { icon }),
  };
  // Android shows notifications only through the service worker, which then opens the run.
  const registration =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration?.active) {
    await registration.showNotification(notification.title, options);
    return;
  }
  const shown = new Notification(notification.title, options);
  shown.addEventListener('click', () => {
    window.focus();
    void navigate(path);
    shown.close();
  });
}

// Notifies of the runs that come into the inbox while the dashboard is open, as each routine asks.
export function useRunNotifications() {
  const { data } = useInbox();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const previousRuns = useRef<RunRecord[] | null>(null);

  useEffect(() => {
    if (data === undefined) return;
    const previous = previousRuns.current;
    previousRuns.current = data.runs;
    if (previous === null || !isMatching('granted', readNotificationAccess())) return;
    const isPageShown = isMatching('visible', document.visibilityState);
    const runs = listRunsToNotify(previous, data).filter(
      run => !isPageShown || pathname !== getRunPath(run.routine, run.id),
    );
    for (const notification of buildRunNotifications(runs)) {
      // A browser that cannot show it here may reject, and then there is nothing to show.
      showNotification(notification, navigate).catch(() => undefined);
    }
  }, [data, navigate, pathname]);
}
