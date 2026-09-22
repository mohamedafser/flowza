/**
 * Defer admin list "loading start" updates until after paint.
 * Avoids both react-hooks/set-state-in-effect (sync setState in effects)
 * and "state update on a component that hasn't mounted yet" (queueMicrotask
 * from refs/render can still fire too early).
 */
export function scheduleAdminFetchStart(run: () => void): () => void {
  let cancelled = false;
  const timer = window.setTimeout(() => {
    if (!cancelled) run();
  }, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
