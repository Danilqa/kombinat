import { useSyncExternalStore } from 'react';

const PHONE_QUERY = '(width < 40rem)';

function subscribeToPhoneQuery(onChange: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function checkIsPhone(): boolean {
  return window.matchMedia(PHONE_QUERY).matches;
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhoneQuery, checkIsPhone);
}
