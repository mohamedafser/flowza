import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderNotificationTemplate } from "@/lib/notifications/templates";

const root = resolve(__dirname, "../..");
const migrationsDir = resolve(root, "supabase/migrations");

function readMigration(namePart: string): string {
  const file = readdirSync(migrationsDir).find((entry) =>
    entry.includes(namePart),
  );
  expect(file).toBeTruthy();
  return readFileSync(resolve(migrationsDir, file!), "utf8");
}

describe("reservations schema migration", () => {
  it("commits ARRIVED enum value before it is referenced", () => {
    const arrived = readMigration("reservation_status_arrived");
    expect(arrived).toContain("ADD VALUE IF NOT EXISTS 'ARRIVED'");

    const sql = readMigration("reservations_and_walkins");
    expect(sql).not.toContain("ADD VALUE IF NOT EXISTS 'ARRIVED'");
    expect(sql).toContain("ARRIVED");
  });

  it("extends reservations with lifecycle fields and queue linking", () => {
    const sql = readMigration("reservations_and_walkins");
    expect(sql).toContain("reservation_code");
    expect(sql).toContain("duration_minutes");
    expect(sql).toContain("arrived_at");
    expect(sql).toContain("allocate_reservation_code");
    expect(sql).toContain("reservation_transition");
    expect(sql).toContain("branch_is_open_at");
    expect(sql).toContain("queue_entries");
    expect(sql).toContain("reservation_id");
    expect(sql).toContain("queue_entries_active_reservation_unique");
    expect(sql).toContain("add_table_to_realtime_publication");
    expect(sql).toContain("public.reservations");
    expect(sql).not.toMatch(
      /CREATE POLICY[\s\S]{0,240}USING\s*\(\s*true\s*\)/i,
    );
  });

  it("prevents double-booking helpers and concurrent code allocation", () => {
    const sql = readMigration("reservations_and_walkins");
    expect(sql).toContain("reservation_table_has_conflict");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("reservation_code_counters");
    expect(sql).toContain("CLEANING");
  });
});

describe("reservation notification templates", () => {
  it("renders reservation templates without leaking tokens for queue fields", () => {
    const rendered = renderNotificationTemplate("RESERVATION_CONFIRMED", "EMAIL", {
      customerName: "Alex",
      restaurantName: "Flowza Bistro",
      branchName: "Downtown",
      token: "",
      partySize: 4,
      estimatedWait: null,
      position: null,
      queueName: "",
      reservationCode: "RES-1001",
      reservationDate: "2026-09-20",
      reservationTime: "19:00",
      tableName: "12",
    });

    expect(rendered.subject).toContain("Flowza Bistro");
    expect(rendered.body).toContain("confirmed");
    expect(rendered.body).toContain("Alex");
    expect(rendered.body).toContain("RES-1001");
    expect(rendered.html).toContain("RES-1001");
  });

  it("renders staff reservation no-show template", () => {
    const rendered = renderNotificationTemplate(
      "STAFF_RESERVATION_NO_SHOW",
      "IN_APP",
      {
        customerName: "Alex",
        restaurantName: "Flowza Bistro",
        branchName: "Downtown",
        token: "",
        partySize: 2,
        estimatedWait: null,
        position: null,
        queueName: "",
        reservationCode: "RES-1002",
        reservationDate: "2026-09-20",
        reservationTime: "20:00",
        tableName: null,
      },
    );
    expect(rendered.title).toMatch(/no-show/i);
    expect(rendered.body).toContain("RES-1002");
  });
});
