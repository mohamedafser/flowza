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

type CustomerPushEnableButtonProps = {
  accessToken: string;
  className?: string;
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

export function CustomerPushEnableButton({
  accessToken,
  className,
}: CustomerPushEnableButtonProps) {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [available, setAvailable] = useState(true);
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

    const key = await fetchVapidPublicKey();
    setAvailable(Boolean(key));
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
          setAvailable(false);
          toast.error("Push notifications are not available right now.");
          return;
        }

        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);
        if (permissionResult !== "granted") {
          toast.error("Notification permission was blocked.");
          return;
        }

        const registration = await ensurePushServiceWorker();
        if (!registration) {
          toast.error("Unable to enable notifications on this device.");
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
        const response = await fetch(
          `/api/public/queue/${encodeURIComponent(accessToken)}/push`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscription: payload,
              clickUrl: window.location.href,
            }),
          },
        );
        if (!response.ok) {
          toast.error("Unable to enable push notifications.");
          return;
        }
        setSubscribed(true);
        toast.success("We'll notify you when it's your turn.");
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
        await fetch(
          `/api/public/queue/${encodeURIComponent(accessToken)}/push`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          },
        );
        await subscription.unsubscribe();
        setSubscribed(false);
        toast.success("Push notifications turned off.");
      } catch {
        toast.error("Unable to turn off push notifications.");
      }
    });
  }

  if (permission === "unsupported" || !available) {
    return null;
  }

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card/40 p-4", className)}>
      <p className="text-sm font-medium">Get a push when you are called</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Allow notifications so we can alert you on this device when your table is
        ready.
      </p>
      <div className="mt-3">
        {subscribed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={disable}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BellOff className="size-4" />
            )}
            <span className="ml-1.5">Turn off alerts</span>
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={enable}
            disabled={pending || permission === "denied"}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BellRing className="size-4" />
            )}
            <span className="ml-1.5">Enable push alerts</span>
          </Button>
        )}
      </div>
      {permission === "denied" ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Permission is blocked in your browser settings.
        </p>
      ) : null}
    </div>
  );
}
