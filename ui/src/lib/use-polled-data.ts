import { useCallback, useEffect, useRef, useState } from 'react';

const ACTIVE_INTERVAL_MS = 5000;
const IDLE_INTERVAL_MS = 15000;

type PollIntervals = {
  activeMs: number;
  idleMs: number;
};

const defaultIntervals: PollIntervals = { activeMs: ACTIVE_INTERVAL_MS, idleMs: IDLE_INTERVAL_MS };

type PolledData<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  reload: () => void;
};

export function usePolledData<T>(
  key: string,
  load: () => Promise<T>,
  getIsActive: (data: T) => boolean,
  intervals: PollIntervals = defaultIntervals,
): PolledData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadRef = useRef(load);
  const getIsActiveRef = useRef(getIsActive);
  loadRef.current = load;
  getIsActiveRef.current = getIsActive;
  const { activeMs, idleMs } = intervals;

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function runTick() {
      try {
        const next = await loadRef.current();
        if (isCancelled) return;
        setData(next);
        setError(null);
        timer = setTimeout(runTick, getIsActiveRef.current(next) ? activeMs : idleMs);
      } catch (err) {
        if (isCancelled) return;
        setError((err as Error).message);
        timer = setTimeout(runTick, idleMs);
      }
    }

    void runTick();
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [key, reloadToken, activeMs, idleMs]);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [key]);

  const reload = useCallback(() => setReloadToken(token => token + 1), []);

  return { data, error, isLoading: data === null && error === null, reload };
}
