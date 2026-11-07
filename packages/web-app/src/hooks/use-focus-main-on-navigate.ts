import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

export function useFocusMainOnNavigate(mainId: string) {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    window.scrollTo(0, 0);
    document.getElementById(mainId)?.focus({ preventScroll: true });
  }, [pathname, mainId]);
}
