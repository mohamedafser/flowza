import { describe, expect, it } from "vitest";
import {
  channelEnabledForCustomer,
  channelEnabledForRestaurant,
  DEFAULT_CUSTOMER_PREFERENCES,
  DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS,
} from "@/lib/notifications/preferences";
import { isWebPushConfigured } from "@/lib/notifications/push/config";
import { urlBase64ToUint8Array } from "@/lib/notifications/push/client";

describe("web push preferences", () => {
  it("gates PUSH on the same in-app preference flags", () => {
    expect(
      channelEnabledForCustomer("PUSH", DEFAULT_CUSTOMER_PREFERENCES),
    ).toBe(true);
    expect(
      channelEnabledForCustomer("PUSH", {
        ...DEFAULT_CUSTOMER_PREFERENCES,
        inAppEnabled: false,
      }),
    ).toBe(false);
    expect(
      channelEnabledForRestaurant(
        "PUSH",
        DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS,
      ),
    ).toBe(true);
    expect(
      channelEnabledForRestaurant("PUSH", {
        ...DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS,
        notificationsInAppEnabled: false,
      }),
    ).toBe(false);
  });
});

describe("web push helpers", () => {
  it("reports unconfigured without VAPID env", () => {
    expect(isWebPushConfigured()).toBe(false);
  });

  it("decodes url-safe base64 VAPID keys", () => {
    // Fixed test vector (not a real secret).
    const bytes = urlBase64ToUint8Array("AQID");
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});
