"use client";

import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import type { PublicDisplayTokenRef } from "@/lib/public-display/types";

type DisplayNextTokensProps = {
  tokens: PublicDisplayTokenRef[];
};

export function DisplayNextTokens({ tokens }: DisplayNextTokensProps) {
  return (
    <section className="border-border/60 border-t pt-8 text-center">
      <p className="text-muted-foreground text-sm font-medium tracking-[0.25em] uppercase sm:text-base">
        {PUBLIC_DISPLAY_MESSAGES.nextInLine}
      </p>
      {tokens.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-xl sm:text-2xl lg:text-3xl">
          {PUBLIC_DISPLAY_MESSAGES.noWaiting}
        </p>
      ) : (
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8 lg:gap-12">
          {tokens.map((entry) => (
            <li
              key={entry.token}
              className="font-semibold tracking-tight"
              style={{ fontSize: "clamp(2rem, 5vw, 4.5rem)" }}
            >
              {entry.token}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
