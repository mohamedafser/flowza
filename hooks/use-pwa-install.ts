"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  PWA_INSTALL_DISMISS_DAYS,
  PWA_INSTALL_DISMISS_KEY,
} from "@/lib/constants";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  const mediaStandalone = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

function wasDismissedRecently(): boolean {
  const raw = window.localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const ms = PWA_INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < ms;
}

function subscribeStandalone(onStoreChange: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

function subscribeNoop() {
  return () => {};
}

export function usePwaInstall() {
  const installed = useSyncExternalStore(
    subscribeStandalone,
    isStandaloneDisplay,
    () => false,
  );
  const ios = useSyncExternalStore(subscribeNoop, isIosDevice, () => false);
  const recentlyDismissedStore = useSyncExternalStore(
    subscribeNoop,
    wasDismissedRecently,
    () => false,
  );
  const ready = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [recentlyDismissedOverride, setRecentlyDismissedOverride] = useState<
    boolean | null
  >(null);

  const recentlyDismissed = recentlyDismissedOverride ?? recentlyDismissedStore;

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(Date.now()));
    setDismissed(true);
    setRecentlyDismissedOverride(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "unavailable" as const };
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome !== "accepted") {
      dismiss();
    }
    return { outcome: choice.outcome };
  }, [deferredPrompt, dismiss]);

  const supportsNativePrompt = Boolean(deferredPrompt);
  const canPrompt =
    ready &&
    !installed &&
    !dismissed &&
    !recentlyDismissed &&
    (supportsNativePrompt || ios);

  return {
    installed,
    isIos: ios,
    canPrompt,
    supportsNativePrompt,
    promptInstall,
    dismiss,
  };
}
