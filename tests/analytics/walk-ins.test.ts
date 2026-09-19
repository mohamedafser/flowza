import { describe, expect, it } from "vitest";
import { getWalkInAnalytics } from "@/services/analytics/walk-ins";
import type { QueueAnalyticsRow } from "@/lib/analytics/aggregations";

describe("walk-in analytics", () => {
  it("aggregates audit-based walk-ins and queue completion", () => {
    const queueRows: QueueAnalyticsRow[] = [
      {
        id: "qe1",
        customer_id: "c1",
        reservation_id: null,
        party_size: 2,
        status: "COMPLETED",
        business_date: "2026-09-19",
        joined_at: "2026-09-19T12:00:00.000Z",
        called_at: "2026-09-19T12:15:00.000Z",
        seated_at: "2026-09-19T12:16:00.000Z",
        completed_at: "2026-09-19T12:45:00.000Z",
      },
      {
        id: "qe2",
        customer_id: "c2",
        reservation_id: null,
        party_size: 2,
        status: "WAITING",
        business_date: "2026-09-19",
        joined_at: "2026-09-19T13:00:00.000Z",
        called_at: null,
        seated_at: null,
        completed_at: null,
      },
    ];

    const result = getWalkInAnalytics({
      auditRows: [
        {
          action: "walk_in.created",
          entity_id: "qe1",
          metadata: { branchId: "b1" },
          created_at: "2026-09-19T12:00:00.000Z",
        },
        {
          action: "walk_in.created",
          entity_id: "qe2",
          metadata: { branchId: "b1" },
          created_at: "2026-09-19T13:00:00.000Z",
        },
        {
          action: "walk_in.seated",
          entity_id: "c3",
          metadata: { branchId: "b1", tableId: "t1" },
          created_at: "2026-09-19T14:00:00.000Z",
        },
      ],
      queueRows,
    });

    expect(result.total).toBe(3);
    expect(result.addedToQueue).toBe(2);
    expect(result.seatedDirectly).toBe(1);
    expect(result.averageWaitMinutes).toBe(15);
    expect(result.completionRate.rate).toBe(0.5);
    expect(result.basedOnAuditLogs).toBe(true);
  });

  it("returns empty metrics for no walk-ins", () => {
    const result = getWalkInAnalytics({ auditRows: [], queueRows: [] });
    expect(result.total).toBe(0);
    expect(result.averageWaitMinutes).toBeNull();
    expect(result.completionRate.rate).toBeNull();
  });
});
