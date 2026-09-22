import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/platform-guards", () => ({
  requirePlatformPermission: vi.fn(async () => ({
    user: { id: "admin-user" },
    profile: { platform_role: "SUPER_ADMIN", account_status: "ACTIVE" },
    platformRole: "SUPER_ADMIN",
  })),
}));

vi.mock("@/services/admin/admin-client", () => ({
  requireAdminClient: vi.fn(),
  buildPageResult: (
    items: unknown[],
    total: number,
    page: number,
    pageSize: number,
  ) => ({
    items,
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    hasNext: page * pageSize < total,
    hasPrev: page > 1,
  }),
  emptyPage: (page = 1, pageSize = 20) => ({
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  }),
  escapeIlike: (value: string) => value.replace(/[%_\\]/g, "\\$&"),
}));

vi.mock("@/services/audit", () => ({
  writePlatformAuditLog: vi.fn(async () => undefined),
}));

import { requirePlatformPermission } from "@/lib/auth/platform-guards";
import { requireAdminClient } from "@/services/admin/admin-client";
import { writePlatformAuditLog } from "@/services/audit";
import { updateAdminRestaurantStatus } from "@/services/admin/admin-restaurants.service";
import { updateAdminUserAccountStatus } from "@/services/admin/admin-users.service";
import { setAdminPlanActive } from "@/services/admin/admin-plans.service";

function mockFrom(handlers: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const handler = handlers[table];
      if (!handler) {
        throw new Error(`Unexpected table ${table}`);
      }
      return handler;
    },
    auth: {
      admin: {
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
        getUserById: vi.fn(async () => ({
          data: { user: { email: "a@example.com" } },
        })),
        listUsers: vi.fn(async () => ({ data: { users: [] } })),
      },
    },
  };
}

describe("admin restaurant status mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires manage permission and writes audit on suspend", async () => {
    const restaurantUpdate = vi.fn(() => ({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: {
              id: "r1",
              status: "SUSPENDED",
              organization_id: "o1",
              name: "Demo",
            },
            error: null,
          }),
        }),
      }),
    }));

    vi.mocked(requireAdminClient).mockReturnValue(
      mockFrom({
        restaurants: {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "r1",
                  status: "ACTIVE",
                  organization_id: "o1",
                  name: "Demo",
                },
              }),
            }),
          }),
          update: restaurantUpdate,
        },
        organizations: {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        },
      }) as never,
    );

    const result = await updateAdminRestaurantStatus("r1", "SUSPENDED");
    expect(requirePlatformPermission).toHaveBeenCalledWith(
      "platform.restaurants.manage",
    );
    expect(result.status).toBe("SUSPENDED");
    expect(writePlatformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RESTAURANT_SUSPENDED",
        entityId: "r1",
      }),
    );
  });
});

describe("admin user status mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects disabling self and SUPER_ADMIN targets", async () => {
    vi.mocked(requireAdminClient).mockReturnValue(
      mockFrom({
        profiles: {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "admin-user",
                  platform_role: null,
                  account_status: "ACTIVE",
                },
              }),
            }),
          }),
        },
      }) as never,
    );

    await expect(
      updateAdminUserAccountStatus("admin-user", "DISABLED"),
    ).rejects.toThrow(/own account/i);

    vi.mocked(requireAdminClient).mockReturnValue(
      mockFrom({
        profiles: {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "other-admin",
                  platform_role: "SUPER_ADMIN",
                  account_status: "ACTIVE",
                },
              }),
            }),
          }),
        },
      }) as never,
    );

    await expect(
      updateAdminUserAccountStatus("other-admin", "DISABLED"),
    ).rejects.toThrow(/SUPER_ADMIN/i);
  });
});

describe("admin plan activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-deactivates plans and audits the change", async () => {
    vi.mocked(requireAdminClient).mockReturnValue(
      mockFrom({
        subscriptions: {
          select: () => ({
            eq: () => ({
              in: async () => ({ count: 2 }),
            }),
          }),
        },
        plans: {
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: { id: "p1", code: "STARTER", is_active: false },
                  error: null,
                }),
              }),
            }),
          }),
        },
      }) as never,
    );

    const plan = await setAdminPlanActive("p1", false);
    expect(plan.is_active).toBe(false);
    expect(writePlatformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PLAN_DEACTIVATED" }),
    );
  });
});
