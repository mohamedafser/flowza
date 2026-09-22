/** Convert a URL-safe base64 VAPID public key to a Uint8Array for PushManager. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type BrowserPushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function serializePushSubscription(
  subscription: PushSubscription,
): BrowserPushSubscriptionJSON {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Incomplete push subscription.");
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

/**
 * Ensure a service worker that can receive push is registered.
 * Uses dedicated /sw-push.js so push works in development (next-pwa is disabled there)
 * and is also imported by the production PWA worker.
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) {
      // Prefer a registration that already controls this page when possible.
      return existing;
    }
    return await navigator.serviceWorker.register("/sw-push.js", {
      scope: "/",
    });
  } catch {
    return null;
  }
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  const registration = await ensurePushServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}
