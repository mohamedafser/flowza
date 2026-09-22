"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const QUEUE = [
  { token: "A042", party: "Patel · 4", wait: "0m" },
  { token: "A043", party: "Chen · 2", wait: "8m" },
  { token: "A044", party: "Rivera · 6", wait: "14m" },
  { token: "A045", party: "Okonkwo · 3", wait: "22m" },
  { token: "A046", party: "Nguyen · 5", wait: "28m" },
];

const TABLES = [
  { id: "12", seats: 4, status: "ready" as const },
  { id: "08", seats: 2, status: "seated" as const },
  { id: "15", seats: 6, status: "clearing" as const },
  { id: "03", seats: 4, status: "seated" as const },
  { id: "21", seats: 2, status: "ready" as const },
  { id: "09", seats: 8, status: "seated" as const },
];

const FLOW_STEPS = ["Join", "Wait", "Call", "Seat"] as const;

/**
 * Cinematic product stage: ops console + animated guest-flow path.
 * Decorative reference only.
 */
export function LandingHeroVisual({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [flowStep, setFlowStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      setMounted(true);
      setMotionOk(!reduce);
    }, 0);
    if (reduce) {
      return () => window.clearTimeout(timer);
    }

    const queueId = window.setInterval(() => {
      setActive((n) => (n + 1) % QUEUE.length);
    }, 2600);
    const flowId = window.setInterval(() => {
      setFlowStep((n) => (n + 1) % FLOW_STEPS.length);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(queueId);
      window.clearInterval(flowId);
    };
  }, []);

  const serving = QUEUE[active] ?? QUEUE[0]!;

  return (
    <div
      className={cn(
        "landing-hero-visual relative isolate w-full",
        mounted && "landing-hero-visual-ready",
        className,
      )}
      aria-hidden
    >
      {/* Orbit rings + ambient orbs */}
      <div className="landing-orbit landing-orbit-a" />
      <div className="landing-orbit landing-orbit-b" />
      <div className="landing-orb landing-orb-a" />
      <div className="landing-orb landing-orb-b" />
      <div className="landing-orb landing-orb-c" />

      {/* SVG flow network */}
      <svg
        className="landing-flow-svg pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 520 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="landing-flow-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.09 195)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="oklch(0.7 0.12 45)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="oklch(0.72 0.09 195)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          className="landing-flow-path"
          d="M40 90 C 120 40, 200 160, 280 110 S 420 40, 480 120"
          stroke="url(#landing-flow-stroke)"
          strokeWidth="1.5"
        />
        <path
          className="landing-flow-path landing-flow-path-delay"
          d="M30 280 C 110 320, 180 200, 270 250 S 400 340, 500 280"
          stroke="url(#landing-flow-stroke)"
          strokeWidth="1.25"
        />
        <circle className="landing-flow-dot" r="3.5" fill="oklch(0.72 0.09 195)">
          {motionOk ? (
            <animateMotion
              dur="7s"
              repeatCount="indefinite"
              path="M40 90 C 120 40, 200 160, 280 110 S 420 40, 480 120"
            />
          ) : null}
        </circle>
        <circle className="landing-flow-dot" r="2.5" fill="oklch(0.7 0.12 45)">
          {motionOk ? (
            <animateMotion
              dur="9s"
              begin="1.2s"
              repeatCount="indefinite"
              path="M30 280 C 110 320, 180 200, 270 250 S 400 340, 500 280"
            />
          ) : null}
        </circle>
      </svg>

      {/* Device / console frame */}
      <div className="landing-console relative mx-auto w-full max-w-136">
        <div className="landing-console-bezel">
          <div className="landing-console-chrome">
            <span className="landing-chrome-dot" />
            <span className="landing-chrome-dot" />
            <span className="landing-chrome-dot" />
            <span className="landing-chrome-title">Flowza · Dinner service</span>
          </div>

          <div className="landing-console-body">
            {/* Now serving banner */}
            <div className="landing-serving-band">
              <div>
                <p className="text-[0.62rem] font-semibold tracking-[0.22em] text-white/55 uppercase">
                  Now serving
                </p>
                <p
                  key={serving.token}
                  className="font-(family-name:--font-landing-display) landing-token-swap mt-1 text-4xl font-bold tracking-tight text-white sm:text-5xl"
                >
                  {serving.token}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[0.62rem] font-semibold tracking-[0.18em] text-white/55 uppercase">
                  Party
                </p>
                <p
                  key={serving.party}
                  className="landing-token-swap mt-1 text-sm font-medium text-white/90"
                >
                  {serving.party}
                </p>
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  <span className="landing-pulse-dot bg-emerald-400" />
                  <span className="text-[0.65rem] font-medium tracking-wide text-emerald-300/90 uppercase">
                    Live
                  </span>
                </div>
              </div>
            </div>

            {/* Journey stepper */}
            <div className="landing-journey">
              {FLOW_STEPS.map((label, index) => {
                const on = index <= flowStep;
                const current = index === flowStep;
                return (
                  <div key={label} className="landing-journey-step">
                    <div
                      className={cn(
                        "landing-journey-node",
                        on && "landing-journey-node-on",
                        current && "landing-journey-node-current",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[0.65rem] font-medium tracking-wide",
                        current ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                    {index < FLOW_STEPS.length - 1 ? (
                      <div
                        className={cn(
                          "landing-journey-rail",
                          index < flowStep && "landing-journey-rail-on",
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
              {/* Queue list */}
              <div className="min-w-0">
                <p className="text-muted-foreground mb-2 text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                  Waitlist
                </p>
                <ul className="space-y-1.5">
                  {QUEUE.slice(0, 4).map((row, index) => {
                    const isActive = index === active % 4;
                    return (
                      <li
                        key={row.token}
                        className={cn(
                          "landing-queue-row flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
                          isActive && "landing-queue-row-active",
                        )}
                      >
                        <span className="w-11 shrink-0 font-semibold tracking-wide">
                          {row.token}
                        </span>
                        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                          {row.party}
                        </span>
                        <span className="text-muted-foreground shrink-0 tabular-nums text-xs">
                          {isActive ? "call" : row.wait}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Floor grid */}
              <div className="min-w-0">
                <p className="text-muted-foreground mb-2 text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
                  Tables
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {TABLES.map((table, index) => (
                    <div
                      key={table.id}
                      className={cn(
                        "landing-table-tile flex aspect-square flex-col items-center justify-center rounded-lg text-[0.65rem] font-semibold",
                        table.status === "ready" && "landing-table-ready",
                        table.status === "seated" && "landing-table-seated",
                        table.status === "clearing" && "landing-table-clearing",
                        active % TABLES.length === index &&
                          "landing-table-highlight",
                      )}
                      style={{ animationDelay: `${index * 0.14}s` }}
                    >
                      <span>T{table.id}</span>
                      <span className="mt-0.5 text-[0.55rem] font-medium opacity-65 capitalize">
                        {table.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating secondary panel — display board preview */}
        <div className="landing-float-panel">
          <p className="text-[0.58rem] font-semibold tracking-[0.2em] text-white/50 uppercase">
            Lobby display
          </p>
          <p className="font-(family-name:--font-landing-display) mt-1 text-2xl font-bold tracking-tight text-white">
            {serving.token}
          </p>
          <p className="mt-0.5 text-[0.7rem] text-white/65">Please proceed</p>
        </div>
      </div>
    </div>
  );
}
