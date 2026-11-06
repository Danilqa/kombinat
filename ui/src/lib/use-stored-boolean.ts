import { useCallback, useState } from 'react';

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
}

// A preference this browser remembers. Where storage is blocked it still works, until the next reload.
export function useStoredBoolean(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => readStoredBoolean(key, fallback));
  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Storage is blocked: the value lasts for this page only.
      }
    },
    [key],
  );
  return [value, update];
}
