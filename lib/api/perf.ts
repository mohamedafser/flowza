/**
 * Lightweight API/request timing for development and opt-in production debug.
 * Never logs secrets or PII — only durations and opaque labels.
 *
 * Enable in production with: API_PERF_LOG=1
 * In development, logging is on by default.
 */

export type PerfPhase =
  | "auth"
  | "authorization"
  | "database"
  | "external"
  | "transform"
  | "serialize"
  | "total"
  | (string & {});

export type PerfTimer = {
  /** Accumulate elapsed ms for a named phase from an async/sync block. */
  measure: <T>(phase: PerfPhase, run: () => Promise<T> | T) => Promise<T>;
  /** Record wall time since the previous mark (sequential phases). */
  mark: (phase: PerfPhase) => void;
  end: () => number;
  snapshot: () => Record<string, number>;
  log: (label: string) => void;
};

function perfLoggingEnabled(): boolean {
  if (process.env.API_PERF_LOG === "1") return true;
  if (process.env.API_PERF_LOG === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function startTimer(): PerfTimer {
  const started = performance.now();
  const marks = new Map<string, number>();
  let last = started;

  return {
    async measure(phase, run) {
      const before = performance.now();
      try {
        return await run();
      } finally {
        const elapsed = performance.now() - before;
        marks.set(phase, (marks.get(phase) ?? 0) + elapsed);
        last = performance.now();
      }
    },
    mark(phase) {
      const now = performance.now();
      marks.set(phase, (marks.get(phase) ?? 0) + (now - last));
      last = now;
    },
    end() {
      const total = performance.now() - started;
      marks.set("total", total);
      return total;
    },
    snapshot() {
      return Object.fromEntries(marks.entries());
    },
    log(label) {
      if (!perfLoggingEnabled()) return;
      this.end();
      const rounded: Record<string, number> = {};
      for (const [key, ms] of Object.entries(this.snapshot())) {
        rounded[key] = Math.round(ms);
      }
      console.info(
        JSON.stringify({
          scope: "api_perf",
          label,
          phases: rounded,
        }),
      );
    },
  };
}
