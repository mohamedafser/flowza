"use client";

import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import type { QueueStatus } from "@/lib/validations/queue";
import { cn } from "@/lib/utils";

type DisplayNowServingProps = {
  token: string | null;
  queueStatus: QueueStatus;
};

export function DisplayNowServing({
  token,
  queueStatus,
}: DisplayNowServingProps) {
  const showEmpty = !token || (queueStatus === "CLOSED" && !token);
  const value = showEmpty
    ? PUBLIC_DISPLAY_MESSAGES.emptyServing
    : (token as string);

  return (
    <section
      className="flex flex-col items-center justify-center text-center"
      aria-live="assertive"
      aria-atomic="true"
    >
      <p className="text-muted-foreground text-sm font-medium tracking-[0.25em] uppercase sm:text-base lg:text-lg">
        {PUBLIC_DISPLAY_MESSAGES.nowServing}
      </p>
      <p
        key={value}
        className={cn(
          "mt-4 font-semibold tracking-tight sm:mt-6",
          "text-[clamp(4.5rem,14vw,12rem)] leading-none",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300",
        )}
      >
        {value}
      </p>
      {!showEmpty ? (
        <p className="text-muted-foreground mt-4 text-lg sm:mt-6 sm:text-2xl lg:text-3xl">
          {PUBLIC_DISPLAY_MESSAGES.pleaseProceed}
        </p>
      ) : null}
    </section>
  );
}
