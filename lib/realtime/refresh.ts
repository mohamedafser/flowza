export function createCoalescedRefresh(
  run: () => Promise<void> | void,
  delayMs = 200,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let queued = false;
  let stopped = false;
  let generation = 0;

  async function flush() {
    if (stopped) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    const current = ++generation;
    try {
      await run();
    } finally {
      inFlight = false;
      if (!stopped && queued && current === generation) {
        queued = false;
        void flush();
      }
    }
  }

  function request() {
    if (stopped) return;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  function cancel() {
    stopped = true;
    queued = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function isInFlight() {
    return inFlight;
  }

  return { request, cancel, isInFlight };
}

export type CoalescedRefresh = ReturnType<typeof createCoalescedRefresh>;
