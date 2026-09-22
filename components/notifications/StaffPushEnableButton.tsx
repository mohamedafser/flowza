"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ensurePushServiceWorker,
  serializePushSubscription,
  urlBase64ToUint8Array,
} from "@/lib/notifications/push/client";
import { cn } from "@/lib/utils";

type PushEnableButtonProps = {
  restaurantId: string;
  className?: string;
  compact?: boolean;
};

type PermissionState = NotificationPermission | "unsupported";

async function fetchVapidPublicKey(): Promise<string | null> {
  const response = await fetch("/api/push/vapid-public-key", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const json: unknown = await response.json();
  if (
    !json ||
    typeof json !== "object" ||
    !("ok" in json) ||
    !(json as { ok: unknown }).ok ||
    !("data" in json)
  ) {
    return null;
  }
  const data = (json as { data: { publicKey?: string } }).data;
  return data.publicKey?.trim() || null;
}

export function StaffPushEnableButton({
  restaurantId,
  className,
  compact = false,
}: PushEnableButtonProps) {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [pending, startTransition] = useTransition();

  const refreshState = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    const registration = await ensurePushServiceWorker();
    const existing = await registration?.pushManager.getSubscription();
    setSubscribed(Boolean(existing));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) void refreshState();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshState]);

  function enable() {
    startTransition(async () => {
      try {
        const publicKey = await fetchVapidPublicKey();
        if (!publicKey) {
          setConfigured(false);
          toast.error("Push notifications are not configured on the server.");
          return;
        }
        setConfigured(true);

        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);
        if (permissionResult !== "granted") {
          toast.error("Notification permission was blocked.");
          return;
        }

        const registration = await ensurePushServiceWorker();
        if (!registration) {
          toast.error("Unable to register a service worker for push.");
          return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              publicKey,
            ) as BufferSource,
          });
        }

        const payload = serializePushSubscription(subscription);
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, subscription: payload }),
        });
        if (!response.ok) {
          toast.error("Unable to enable push notifications.");
          return;
        }
        setSubscribed(true);
        toast.success("Push notifications enabled for this device.");
      } catch {
        toast.error("Unable to enable push notifications.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const registration = await ensurePushServiceWorker();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) {
          setSubscribed(false);
          return;
        }
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
        setSubscribed(false);
        toast.success("Push notifications disabled on this device.");
      } catch {
        toast.error("Unable to disable push notifications.");
      }
    });
  }

  if (permission === "unsupported") {
    return null;
  }

  if (!configured && !subscribed) {
    return null;
  }

  if (subscribed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(className)}
        onClick={disable}
        disabled={pending}
        aria-label="Disable push notifications"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <BellOff className="size-4" />
        )}
        {compact ? null : <span className="ml-1.5">Push on</span>}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(className)}
      onClick={enable}
      disabled={pending || permission === "denied"}
      aria-label="Enable push notifications"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BellRing className="size-4" />
      )}
      {compact ? null : <span className="ml-1.5">Enable push</span>}
    </Button>
  );
}
