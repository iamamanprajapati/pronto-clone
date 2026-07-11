import { useEffect, useRef } from 'react';

/**
 * Keeps a page's data live without manual reloads. Runs `load`:
 *  - on mount
 *  - when the tab regains focus / becomes visible
 *  - when restored from the back/forward (bfcache) — the classic "I edited it,
 *    went back, and it still shows the old value" case
 *  - on a light poll interval
 */
export function useLiveData(load: () => unknown, intervalMs = 8000) {
  const ref = useRef(load);
  ref.current = load;

  useEffect(() => {
    const run = () => { void ref.current(); };
    run();
    const poll = intervalMs ? setInterval(run, intervalMs) : null;
    const onFocus = () => run();
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) run(); };
    const onVis = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onShow);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (poll) clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onShow);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);
}
