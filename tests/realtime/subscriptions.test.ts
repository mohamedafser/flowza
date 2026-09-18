import { describe, expect, it } from "vitest";
import {
  subscribeToPublicQueue,
  subscribeToQueue,
} from "@/services/realtime/queue-realtime";
import { subscribeToTables } from "@/services/realtime/table-realtime";
import {
  createQueueChannel,
  createTableChannel,
} from "@/lib/realtime/channels";
import { mapChannelSubscribeStatus } from "@/services/realtime/client";
import type { BrowserSupabaseClient } from "@/services/realtime/client";

const restaurantA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const queueA = "11111111-1111-1111-1111-111111111111";
const queueB = "22222222-2222-2222-2222-222222222222";
const branchA = "33333333-3333-3333-3333-333333333333";
const branchB = "44444444-4444-4444-4444-444444444444";

type Listener = {
  event: string;
  table?: string;
  filter?: string;
  handler: (payload: unknown) => void;
};

class FakeChannel {
  name: string;
  listeners: Listener[] = [];
  unsubscribed = false;
  config: Record<string, unknown>;

  constructor(name: string, config: Record<string, unknown> = {}) {
    this.name = name;
    this.config = config;
  }

  on(
    event: string,
    filter: {
      event?: string;
      schema?: string;
      table?: string;
      filter?: string;
    },
    handler: (payload: unknown) => void,
  ) {
    this.listeners.push({
      event,
      table: filter.table,
      filter: filter.filter,
      handler,
    });
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    cb?.("SUBSCRIBED");
    return this;
  }

  unsubscribe() {
    this.unsubscribed = true;
    return "ok";
  }
}

function createFakeClient() {
  const channels: FakeChannel[] = [];
  const client = {
    channels,
    channel(name: string, options?: { config?: Record<string, unknown> }) {
      const channel = new FakeChannel(name, options?.config ?? {});
      channels.push(channel);
      return channel;
    },
    async removeChannel(channel: FakeChannel) {
      channel.unsubscribed = true;
    },
  };
  return client as unknown as BrowserSupabaseClient & {
    channels: FakeChannel[];
  };
}

describe("staff queue realtime subscriptions", () => {
  it("creates one scoped channel and cleans it up", () => {
    const client = createFakeClient();
    const unsubscribe = subscribeToQueue({
      client,
      restaurantId: restaurantA,
      queueId: queueA,
      branchId: branchA,
      onChange: () => undefined,
    });

    expect(client.channels).toHaveLength(1);
    expect(client.channels[0]?.name).toBe(
      createQueueChannel(restaurantA, queueA),
    );
    const tables = client.channels[0]?.listeners.map(
      (listener) => listener.table,
    );
    expect(tables).toEqual(
      expect.arrayContaining(["queue_entries", "queues", "restaurant_tables"]),
    );
    expect(tables).not.toContain("customers");
    expect(
      client.channels[0]?.listeners.find(
        (listener) => listener.table === "queue_entries",
      )?.filter,
    ).toBe(`queue_id=eq.${queueA}`);
    expect(
      client.channels[0]?.listeners.find(
        (listener) => listener.table === "restaurant_tables",
      )?.filter,
    ).toBe(`branch_id=eq.${branchA}`);
    expect(
      client.channels[0]?.listeners.some(
        (listener) => listener.event === "broadcast",
      ),
    ).toBe(false);

    unsubscribe();
    expect(client.channels[0]?.unsubscribed).toBe(true);
  });

  it("ignores another queue's postgres payload", () => {
    const client = createFakeClient();
    const received: string[] = [];
    subscribeToQueue({
      client,
      restaurantId: restaurantA,
      queueId: queueA,
      branchId: branchA,
      onChange: (change) => received.push(change.queueId ?? ""),
    });
    const listener = client.channels[0]?.listeners.find(
      (item) => item.table === "queue_entries",
    );
    listener?.handler({
      eventType: "UPDATE",
      table: "queue_entries",
      new: { id: "e2", queue_id: queueB },
    });
    expect(received).toEqual([]);
    listener?.handler({
      eventType: "UPDATE",
      table: "queue_entries",
      new: { id: "e1", queue_id: queueA },
    });
    expect(received).toEqual([queueA]);
  });

  it("replaces the previous subscription when the queue or branch changes", () => {
    const client = createFakeClient();
    const first = subscribeToQueue({
      client,
      restaurantId: restaurantA,
      queueId: queueA,
      branchId: branchA,
      onChange: () => undefined,
    });
    const second = subscribeToQueue({
      client,
      restaurantId: restaurantA,
      queueId: queueB,
      branchId: branchB,
      onChange: () => undefined,
    });
    expect(client.channels.map((channel) => channel.name)).toEqual([
      createQueueChannel(restaurantA, queueA),
      createQueueChannel(restaurantA, queueB),
    ]);
    first();
    expect(client.channels[0]?.unsubscribed).toBe(true);
    expect(client.channels[1]?.unsubscribed).toBe(false);
    second();
    expect(client.channels[1]?.unsubscribed).toBe(true);
  });
});

describe("customer public queue realtime", () => {
  it("subscribes only to a sanitized broadcast and never postgres_changes", () => {
    const client = createFakeClient();
    const topic = createQueueChannel(restaurantA, queueA);
    const received: string[] = [];
    const unsubscribe = subscribeToPublicQueue({
      client,
      channel: topic,
      onChange: (change) => received.push(change.source),
    });

    expect(client.channels[0]?.name).toBe(topic);
    expect(client.channels[0]?.config).toEqual({ private: false });
    expect(client.channels[0]?.listeners).toHaveLength(1);
    expect(client.channels[0]?.listeners[0]?.event).toBe("broadcast");
    expect(
      client.channels[0]?.listeners.some(
        (listener) => listener.event === "postgres_changes",
      ),
    ).toBe(false);

    const payload = {
      payload: {
        source: "queue_entries",
        phone: "555-0100",
        name: "Ada",
        public_access_token: "leak",
      },
    };
    client.channels[0]?.listeners[0]?.handler(payload);
    expect(received).toEqual(["broadcast"]);
    expect(JSON.stringify(received)).not.toContain("Ada");
    expect(JSON.stringify(received)).not.toContain("555-0100");
    unsubscribe();
    expect(client.channels[0]?.unsubscribed).toBe(true);
  });

  it("rejects an access-token channel name", () => {
    const client = createFakeClient();
    const statuses: string[] = [];
    const unsubscribe = subscribeToPublicQueue({
      client,
      channel: "status/abcdefghijklmnopqrstuvwxyz0123456789abcd",
      onChange: () => undefined,
      onStatus: (status) => statuses.push(status),
    });
    expect(client.channels).toHaveLength(0);
    expect(statuses).toContain("error");
    unsubscribe();
  });
});

describe("table realtime subscriptions", () => {
  it("scopes tables to a branch and cleans up", () => {
    const client = createFakeClient();
    const received: string[] = [];
    const unsubscribe = subscribeToTables({
      client,
      restaurantId: restaurantA,
      branchId: branchA,
      onChange: (change) => received.push(change.branchId ?? ""),
    });
    expect(client.channels[0]?.name).toBe(
      createTableChannel(restaurantA, branchA),
    );
    expect(client.channels[0]?.listeners[0]?.filter).toBe(
      `branch_id=eq.${branchA}`,
    );
    client.channels[0]?.listeners[0]?.handler({
      eventType: "UPDATE",
      table: "restaurant_tables",
      new: { id: "t1", branch_id: branchB, status: "OCCUPIED" },
    });
    expect(received).toEqual([]);
    client.channels[0]?.listeners[0]?.handler({
      eventType: "UPDATE",
      table: "restaurant_tables",
      new: { id: "t1", branch_id: branchA, status: "OCCUPIED" },
    });
    expect(received).toEqual([branchA]);
    unsubscribe();
    expect(client.channels[0]?.unsubscribed).toBe(true);
  });
});

describe("reconnect status mapping", () => {
  it("maps supabase channel states without throwing", () => {
    expect(mapChannelSubscribeStatus("SUBSCRIBED", false)).toBe("connected");
    expect(mapChannelSubscribeStatus("CLOSED", true)).toBe("reconnecting");
    expect(mapChannelSubscribeStatus("CHANNEL_ERROR", false)).toBe("error");
    expect(mapChannelSubscribeStatus("TIMED_OUT", true)).toBe("reconnecting");
    expect(mapChannelSubscribeStatus("CLOSED", false)).toBe("disconnected");
  });
});
