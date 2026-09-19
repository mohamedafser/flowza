import { describe, expect, it, vi } from "vitest";
import { sendNotification } from "@/lib/notifications/service";
import type { NotificationProviders } from "@/lib/notifications/dispatcher";
import type { NotificationResult } from "@/lib/notifications/types";
import type {
  EmailProvider,
  InAppProvider,
  SmsProvider,
  WhatsAppProvider,
} from "@/lib/notifications/providers/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

type NotificationRow = Tables<"notifications">;

const RID = "a1111111-1111-4111-8111-111111111111";
const CID = "a2222222-2222-4222-8222-222222222222";
const EID = "a3333333-3333-4333-8333-333333333333";
const BID = "a4444444-4444-4444-8444-444444444444";
const NID = "a5555555-5555-4555-8555-555555555555";

function makeRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: NID,
    restaurant_id: RID,
    customer_id: CID,
    queue_entry_id: EID,
    reservation_id: null,
    branch_id: BID,
    channel: "IN_APP",
    type: "STAFF_QUEUE_JOINED",
    status: "PENDING",
    recipient: `restaurant:${RID}`,
    payload: {},
    audience: "STAFF",
    provider: null,
    provider_message_id: null,
    attempts: 0,
    last_attempt_at: null,
    error_code: null,
    error_message: null,
    scheduled_at: null,
    idempotency_key: "key-1",
    title: "New guest",
    body: "Token A1",
    sent_at: null,
    created_at: "2026-09-19T10:00:00.000Z",
    updated_at: "2026-09-19T10:00:00.000Z",
    ...overrides,
  };
}

function createMockClient(options: {
  enqueue: NotificationRow;
  claim?: NotificationRow | null;
  mark?: NotificationRow | null;
}): SupabaseClient<Database> {
  const settings = {
    notifications_email_enabled: true,
    notifications_whatsapp_enabled: true,
    notifications_sms_enabled: true,
    notifications_in_app_enabled: true,
    notify_customer_on_join: true,
    notify_customer_on_called: true,
    notify_customer_on_reminder: true,
    notify_staff_on_join: true,
    notify_staff_on_cancel: true,
    notify_staff_on_no_show: true,
    notify_staff_queue_busy_threshold: null,
  };

  return {
    from(table: string) {
      if (table === "restaurant_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: settings, error: null }),
            }),
          }),
        };
      }
      if (table === "customer_notification_preferences") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
    rpc(fn: string) {
      if (fn === "notification_enqueue") {
        return Promise.resolve({ data: options.enqueue, error: null });
      }
      if (fn === "notification_claim") {
        return Promise.resolve({
          data: options.claim === undefined ? options.enqueue : options.claim,
          error: null,
        });
      }
      if (fn === "notification_mark_delivery") {
        return Promise.resolve({
          data:
            options.mark ??
            makeRow({
              ...options.enqueue,
              status: "SENT",
              attempts: 1,
              sent_at: "2026-09-19T10:00:01.000Z",
            }),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "unknown" } });
    },
  } as unknown as SupabaseClient<Database>;
}

const baseInput = {
  restaurantId: RID,
  customerId: CID,
  queueEntryId: EID,
  branchId: BID,
  type: "STAFF_QUEUE_JOINED" as const,
  channel: "IN_APP" as const,
  audience: "STAFF" as const,
  idempotencyKey: `${EID}:STAFF_QUEUE_JOINED:IN_APP:v1`,
  recipient: `restaurant:${RID}`,
  data: {
    customerName: "Ada",
    restaurantName: "Cafe",
    branchName: "Main",
    token: "A1",
    partySize: 2,
    estimatedWait: null,
    position: 1,
    queueName: "Main",
  },
};

const emailNoop: EmailProvider = {
  name: "none",
  isConfigured: () => false,
  send: vi.fn(async (): Promise<NotificationResult> => ({
    ok: false,
    provider: "none",
    retryable: false,
    errorCode: "NOT_CONFIGURED",
  })),
};

const whatsappNoop: WhatsAppProvider = {
  name: "none",
  isConfigured: () => false,
  send: vi.fn(async (): Promise<NotificationResult> => ({
    ok: false,
    provider: "none",
    retryable: false,
    errorCode: "NOT_CONFIGURED",
  })),
};

const smsNoop: SmsProvider = {
  name: "none",
  isConfigured: () => false,
  send: vi.fn(async (): Promise<NotificationResult> => ({
    ok: false,
    provider: "none",
    retryable: false,
    errorCode: "NOT_CONFIGURED",
  })),
};

const inAppOk: InAppProvider = {
  name: "in_app",
  isConfigured: () => true,
  send: vi.fn(async (): Promise<NotificationResult> => ({
    ok: true,
    provider: "in_app",
    retryable: false,
  })),
};

describe("sendNotification service", () => {
  it("creates and dispatches a notification", async () => {
    const client = createMockClient({ enqueue: makeRow() });
    const outcome = await sendNotification(baseInput, {
      client,
      providers: {
        email: emailNoop,
        whatsapp: whatsappNoop,
        sms: smsNoop,
        inApp: inAppOk,
      },
    });

    expect(outcome.status).toBe("sent");
    expect(outcome.notification?.id).toBeTruthy();
  });

  it("returns duplicate when claim fails", async () => {
    const client = createMockClient({
      enqueue: makeRow({ status: "PROCESSING", attempts: 0 }),
      claim: null,
    });

    const outcome = await sendNotification(baseInput, { client });
    expect(outcome.status).toBe("duplicate");
  });

  it("returns duplicate for already-sent rows", async () => {
    const client = createMockClient({
      enqueue: makeRow({ status: "SENT", attempts: 1 }),
    });
    const outcome = await sendNotification(baseInput, { client });
    expect(outcome.status).toBe("duplicate");
  });

  it("records provider failure without throwing", async () => {
    const client = createMockClient({
      enqueue: makeRow({
        channel: "EMAIL",
        type: "QUEUE_JOINED",
        audience: "CUSTOMER",
        recipient: "ada@example.com",
      }),
      mark: makeRow({
        channel: "EMAIL",
        type: "QUEUE_JOINED",
        status: "FAILED",
        attempts: 1,
        error_code: "PROVIDER_ERROR",
      }),
    });

    const providers: NotificationProviders = {
      email: {
        name: "resend",
        isConfigured: () => true,
        send: vi.fn(async (): Promise<NotificationResult> => ({
          ok: false,
          provider: "resend",
          retryable: false,
          errorCode: "PROVIDER_ERROR",
          errorMessage: "Provider rejected the message.",
        })),
      },
      whatsapp: whatsappNoop,
      sms: smsNoop,
      inApp: inAppOk,
    };

    const outcome = await sendNotification(
      {
        ...baseInput,
        type: "QUEUE_JOINED",
        channel: "EMAIL",
        audience: "CUSTOMER",
        recipient: "ada@example.com",
        idempotencyKey: `${EID}:QUEUE_JOINED:EMAIL:v1`,
      },
      { client, providers },
    );

    expect(outcome.status).toBe("failed");
    expect(outcome.result?.ok).toBe(false);
  });

  it("skips invalid payloads", async () => {
    const outcome = await sendNotification({
      ...baseInput,
      restaurantId: "not-a-uuid",
    });
    expect(outcome.status).toBe("skipped");
    expect(outcome.reason).toBe("validation_failed");
  });
});
