"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { fetchPublicDisplay } from "@/lib/api/public-display-client";
import { PUBLIC_DISPLAY_MESSAGES } from "@/lib/public-display/messages";
import { PUBLIC_DISPLAY_FALLBACK_INTERVAL_MS } from "@/lib/public-display/paths";
import {
  resolveDisplayThemeClass,
  type PublicDisplayData,
} from "@/lib/public-display/types";
import { usePublicQueueRealtime } from "@/hooks/realtime/use-queue-realtime";
import { createCoalescedRefresh } from "@/lib/realtime/refresh";
import { REALTIME_MESSAGES } from "@/lib/realtime/messages";
import { REALTIME_REFRESH_DEBOUNCE_MS } from "@/lib/realtime/types";
import { cn } from "@/lib/utils";
import { DisplayUnavailable } from "@/components/public-display/DisplayUnavailable";
import { DisplayNowServing } from "@/components/public-display/DisplayNowServing";
import { DisplayNextTokens } from "@/components/public-display/DisplayNextTokens";
import { DisplayHeader } from "@/components/public-display/DisplayHeader";

type PublicDisplayViewProps = {
  publicToken: string;
  initial: PublicDisplayData;
};

export function PublicDisplayView({
  publicToken,
  initial,
}: PublicDisplayViewProps) {
  const [data, setData] = useState(initial);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(
    null,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const inFlight = useRef(false);
  const refreshController = useRef<ReturnType<
    typeof createCoalescedRefresh
  > | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await fetchPublicDisplay(publicToken);
      if (!result.ok || !result.data) return;
      if (result.data.unavailable) {
        setUnavailableMessage(
          `${result.data.message} ${PUBLIC_DISPLAY_MESSAGES.contactStaff}`,
        );
        return;
      }
      setUnavailableMessage(null);
      setData(result.data);
    } finally {
      inFlight.current = false;
    }
  }, [publicToken]);

  useEffect(() => {
    const controller = createCoalescedRefresh(
      refresh,
      REALTIME_REFRESH_DEBOUNCE_MS,
    );
    refreshController.current = controller;
    return () => {
      controller.cancel();
      if (refreshController.current === controller) {
        refreshController.current = null;
      }
    };
  }, [refresh]);

  const { status: realtimeStatus } = usePublicQueueRealtime({
    channel: data.realtimeChannel,
    enabled: Boolean(data.realtimeChannel),
    onChange: () => {
      refreshController.current?.request();
    },
  });

  useEffect(() => {
    if (realtimeStatus === "connected") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          refreshController.current?.request();
        }
        if (!cancelled) loop();
      }, PUBLIC_DISPLAY_FALLBACK_INTERVAL_MS);
    };

    const onVisibility = () => {
      if (!cancelled && document.visibilityState === "visible") {
        refreshController.current?.request();
      }
    };

    loop();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [realtimeStatus]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!data.settings.preferFullscreen) return;
    const node = rootRef.current;
    if (!node || document.fullscreenElement) return;
    void node.requestFullscreen?.().catch(() => undefined);
  }, [data.settings.preferFullscreen]);

  useEffect(() => {
    let cancelled = false;

    async function requestWakeLock() {
      if (
        !("wakeLock" in navigator) ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
      } catch {
        // Unsupported or denied — TV/browser sleep settings still apply.
      }
    }

    void requestWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const current = wakeLockRef.current;
      wakeLockRef.current = null;
      void current?.release().catch(() => undefined);
    };
  }, []);

  const themeClass = resolveDisplayThemeClass(data.settings.theme);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await rootRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen not available on this browser/TV.
    }
  };

  const reconnecting =
    realtimeStatus === "reconnecting" ||
    realtimeStatus === "disconnected" ||
    realtimeStatus === "error";

  if (unavailableMessage) {
    return <DisplayUnavailable message={unavailableMessage} />;
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "bg-background text-foreground flex min-h-dvh flex-col",
        themeClass,
      )}
      data-display-theme={data.settings.theme}
    >
      <DisplayHeader data={data} />

      <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <DisplayNowServing
          token={data.nowServing?.token ?? null}
          queueStatus={data.queue.status}
        />
        <DisplayNextTokens tokens={data.nextTokens} />
      </main>

      <footer className="flex items-center justify-between gap-3 px-6 py-4 sm:px-10">
        <p
          className="text-muted-foreground text-sm"
          role="status"
          aria-live="polite"
        >
          {reconnecting ? REALTIME_MESSAGES.displayReconnecting : null}
        </p>
        <ButtonFullscreen
          fullscreen={fullscreen}
          onToggle={() => void toggleFullscreen()}
        />
      </footer>
    </div>
  );
}

function ButtonFullscreen({
  fullscreen,
  onToggle,
}: {
  fullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-muted-foreground hover:text-foreground border-border/60 bg-background/40 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm backdrop-blur-sm transition-colors"
    >
      {fullscreen ? (
        <Minimize2 className="size-4" />
      ) : (
        <Maximize2 className="size-4" />
      )}
      {fullscreen
        ? PUBLIC_DISPLAY_MESSAGES.exitFullscreen
        : PUBLIC_DISPLAY_MESSAGES.fullscreen}
    </button>
  );
}
