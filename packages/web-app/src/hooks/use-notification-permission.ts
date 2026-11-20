import { useCallback, useEffect, useState } from 'react';
import { isMatching } from 'ts-pattern';

export type NotificationAccess = NotificationPermission | 'insecure' | 'unsupported';

// Browsers show notifications only to pages on localhost or HTTPS, and iOS only to installed apps.
export function readNotificationAccess(): NotificationAccess {
  if (!window.isSecureContext) return 'insecure';
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export function useNotificationPermission(): [NotificationAccess, () => Promise<void>] {
  const [access, setAccess] = useState(readNotificationAccess);

  // The browser's site settings can change it while the page is open.
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    let status: PermissionStatus | null = null;
    let isMounted = true;
    const update = () => setAccess(readNotificationAccess());
    navigator.permissions
      .query({ name: 'notifications' })
      .then(result => {
        if (!isMounted) return;
        status = result;
        status.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
      status?.removeEventListener('change', update);
    };
  }, []);

  const request = useCallback(async () => {
    if (!isMatching('default', readNotificationAccess())) return;
    await Notification.requestPermission();
    setAccess(readNotificationAccess());
  }, []);

  return [access, request];
}
