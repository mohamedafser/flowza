/* Flowza Web Push service worker
 * Registered in development via /sw-push.js and imported by the production PWA worker.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener("push", (event) => {
  /** @type {PushEvent} */
  const pushEvent = event;
  let title = "Flowza";
  let body = "You have a new update.";
  let url = "/";
  let tag = "flowza-notification";

  try {
    if (pushEvent.data) {
      const payload = pushEvent.data.json();
      if (payload && typeof payload === "object") {
        if (typeof payload.title === "string" && payload.title.trim()) {
          title = payload.title;
        }
        if (typeof payload.body === "string" && payload.body.trim()) {
          body = payload.body;
        }
        if (typeof payload.url === "string" && payload.url.trim()) {
          url = payload.url;
        }
        if (typeof payload.tag === "string" && payload.tag.trim()) {
          tag = payload.tag;
        }
      }
    }
  } catch {
    try {
      const text = pushEvent.data ? pushEvent.data.text() : "";
      if (text) body = text;
    } catch {
      // keep defaults
    }
  }

  const options = {
    body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    tag,
    renotify: true,
    data: { url },
  };

  pushEvent.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawTarget =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      let targetUrl = "/";
      try {
        if (typeof rawTarget === "string" && rawTarget.startsWith("/")) {
          targetUrl = new URL(rawTarget, self.location.origin).href;
        } else if (typeof rawTarget === "string") {
          const parsed = new URL(rawTarget);
          if (parsed.origin === self.location.origin) {
            targetUrl = parsed.href;
          }
        }
      } catch {
        targetUrl = "/";
      }

      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ("focus" in client) {
          if ("navigate" in client && typeof client.navigate === "function") {
            try {
              await client.navigate(targetUrl);
            } catch {
              // ignore navigate failures
            }
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })(),
  );
});
