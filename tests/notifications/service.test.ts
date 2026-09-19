import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildIdempotencyKey } from "@/lib/notifications/constants";
import { renderNotificationTemplate } from "@/lib/notifications/templates";
import {
  channelEnabledForCustomer,
  channelEnabledForRestaurant,
  mapCustomerPreferences,
  typeEnabledForCustomer,
  DEFAULT_CUSTOMER_PREFERENCES,
  DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS,
} from "@/lib/notifications/preferences";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { createEmailProvider } from "@/lib/notifications/providers/email";
import { createWhatsAppProvider } from "@/lib/notifications/providers/whatsapp";
import { createSmsProvider } from "@/lib/notifications/providers/sms";
import { createInAppProvider } from "@/lib/notifications/providers/in-app";
import { maskRecipientHint } from "@/lib/notifications/log";
import type { NotificationProviders } from "@/lib/notifications/dispatcher";
import type { NotificationResult } from "@/lib/notifications/types";

const templateData = {
  customerName: "Ada",
  restaurantName: "Flowza Cafe",
  branchName: "Downtown",
  token: "A12",
  partySize: 3,
  estimatedWait: "15 min",
  position: 4,
  queueName: "Main Queue",
};

describe("notification templates", () => {
  it("renders join confirmation with dynamic values", () => {
    const rendered = renderNotificationTemplate(
      "QUEUE_JOINED",
      "EMAIL",
      templateData,
    );
    expect(rendered.subject).toContain("Flowza Cafe");
    expect(rendered.body).toContain("A12");
    expect(rendered.body).toContain("Party size: 3");
    expect(rendered.body).toContain("Ada");
  });

  it("renders called notification with approach instructions", () => {
    const rendered = renderNotificationTemplate(
      "QUEUE_CALLED",
      "WHATSAPP",
      templateData,
    );
    expect(rendered.body.toLowerCase()).toContain("ready");
    expect(rendered.body).toContain("A12");
    expect(rendered.body.toLowerCase()).toContain("staff");
  });

  it("uses shorter SMS bodies when defined", () => {
    const rendered = renderNotificationTemplate(
      "QUEUE_JOINED",
      "SMS",
      templateData,
    );
    expect(rendered.body.length).toBeLessThan(160);
    expect(rendered.body).toContain("A12");
  });
});

describe("notification preferences", () => {
  it("respects channel opt-out", () => {
    const prefs = {
      ...DEFAULT_CUSTOMER_PREFERENCES,
      emailEnabled: false,
      whatsappEnabled: true,
    };
    expect(channelEnabledForCustomer("EMAIL", prefs)).toBe(false);
    expect(channelEnabledForCustomer("WHATSAPP", prefs)).toBe(true);
  });

  it("respects type opt-out", () => {
    const prefs = {
      ...DEFAULT_CUSTOMER_PREFERENCES,
      notifyQueueCalled: false,
    };
    expect(typeEnabledForCustomer("QUEUE_CALLED", prefs)).toBe(false);
    expect(typeEnabledForCustomer("QUEUE_JOINED", prefs)).toBe(true);
  });

  it("maps null preference rows to defaults", () => {
    expect(mapCustomerPreferences(null)).toEqual(DEFAULT_CUSTOMER_PREFERENCES);
  });

  it("requires restaurant channel enablement", () => {
    const settings = {
      ...DEFAULT_RESTAURANT_NOTIFICATION_SETTINGS,
      notificationsEmailEnabled: false,
      notificationsInAppEnabled: true,
    };
    expect(channelEnabledForRestaurant("EMAIL", settings)).toBe(false);
    expect(channelEnabledForRestaurant("IN_APP", settings)).toBe(true);
  });
});

describe("idempotency keys", () => {
  it("builds stable dedupe keys", () => {
    const key = buildIdempotencyKey({
      queueEntryId: "11111111-1111-1111-1111-111111111111",
      type: "QUEUE_CALLED",
      channel: "EMAIL",
      eventVersion: "2026-09-19T10:00:00.000Z",
    });
    expect(key).toBe(
      "11111111-1111-1111-1111-111111111111:QUEUE_CALLED:EMAIL:2026-09-19T10:00:00.000Z",
    );
  });
});

describe("logging safety", () => {
  it("masks emails and phones", () => {
    expect(maskRecipientHint("ada@example.com")).toBe("a***@example.com");
    expect(maskRecipientHint("+15551234567")).toMatch(/^\*\*\*\d{2}$/);
  });
});

describe("providers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.SMS_PROVIDER_API_KEY;
    delete process.env.SMS_PROVIDER_ENDPOINT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails email gracefully when not configured", async () => {
    const provider = createEmailProvider();
    const result = await provider.send({
      to: "ada@example.com",
      subject: "Hi",
      text: "Hello",
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("NOT_CONFIGURED");
    expect(result.retryable).toBe(false);
  });

  it("rejects invalid email recipients without calling the network", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Flowza <noreply@example.com>";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = createEmailProvider();
    const result = await provider.send({
      to: "not-an-email",
      subject: "Hi",
      text: "Hello",
    });
    expect(result.errorCode).toBe("INVALID_RECIPIENT");
    expect(result.retryable).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns success for mocked email provider responses", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Flowza <noreply@example.com>";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }),
    );
    const provider = createEmailProvider();
    const result = await provider.send({
      to: "ada@example.com",
      subject: "Hi",
      text: "Hello",
    });
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("msg_123");
  });

  it("marks rate limits as retryable", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Flowza <noreply@example.com>";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );
    const provider = createEmailProvider();
    const result = await provider.send({
      to: "ada@example.com",
      subject: "Hi",
      text: "Hello",
    });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorCode).toBe("RATE_LIMITED");
  });

  it("fails WhatsApp when missing configuration", async () => {
    const result = await createWhatsAppProvider().send({
      to: "+15551234567",
      body: "Ready",
    });
    expect(result.errorCode).toBe("NOT_CONFIGURED");
  });

  it("fails SMS when missing configuration", async () => {
    const result = await createSmsProvider().send({
      to: "+15551234567",
      body: "Ready",
    });
    expect(result.errorCode).toBe("NOT_CONFIGURED");
    expect(result.retryable).toBe(false);
  });

  it("treats in-app persistence as successful delivery", async () => {
    const result = await createInAppProvider().send({
      recipient: "restaurant:abc",
      title: "New guest",
      body: "Token A12",
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("in_app");
  });
});

describe("dispatcher", () => {
  it("routes to the matching provider and normalizes results", async () => {
    const providers: NotificationProviders = {
      email: {
        name: "resend",
        isConfigured: () => true,
        send: vi.fn(
          async (): Promise<NotificationResult> => ({
            ok: true,
            provider: "resend",
            retryable: false,
            providerMessageId: "e1",
          }),
        ),
      },
      whatsapp: {
        name: "whatsapp_cloud",
        isConfigured: () => false,
        send: vi.fn(
          async (): Promise<NotificationResult> => ({
            ok: false,
            provider: "none",
            retryable: false,
            errorCode: "NOT_CONFIGURED",
          }),
        ),
      },
      sms: {
        name: "none",
        isConfigured: () => false,
        send: vi.fn(
          async (): Promise<NotificationResult> => ({
            ok: false,
            provider: "none",
            retryable: false,
            errorCode: "NOT_CONFIGURED",
          }),
        ),
      },
      inApp: createInAppProvider(),
    };

    const result = await dispatchNotification({
      channel: "EMAIL",
      recipient: "ada@example.com",
      template: { title: "Hi", body: "Hello", subject: "Subject" },
      providers,
    });

    expect(result.ok).toBe(true);
    expect(providers.email.send).toHaveBeenCalledOnce();
    expect(providers.whatsapp.send).not.toHaveBeenCalled();
  });

  it("does not throw when a provider rejects", async () => {
    const providers: NotificationProviders = {
      email: {
        name: "resend",
        isConfigured: () => true,
        send: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
      whatsapp: createWhatsAppProvider(),
      sms: createSmsProvider(),
      inApp: createInAppProvider(),
    };

    const result = await dispatchNotification({
      channel: "EMAIL",
      recipient: "ada@example.com",
      template: { title: "Hi", body: "Hello" },
      providers,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("UNKNOWN");
  });
});
