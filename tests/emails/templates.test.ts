import { describe, expect, it } from "vitest";
import {
  EMAIL_PREVIEW_IDS,
  renderEmailPreview,
} from "@/emails/preview/samples";
import { renderSignupOtpEmail } from "@/emails/templates/auth";
import { renderNotificationEmail } from "@/emails/templates/notifications";
import { renderNotificationTemplate } from "@/lib/notifications/templates";
import { CUSTOMER_NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { escapeHtml, safeName, safeValue } from "@/emails/utils/personalize";

const queueData = {
  customerName: "Ada",
  restaurantName: "Flowza Cafe",
  branchName: "Downtown",
  token: "A12",
  partySize: 3,
  estimatedWait: "15 min",
  position: 4,
  queueName: "Main Queue",
};

const reservationData = {
  customerName: "Ada",
  restaurantName: "Flowza Cafe",
  branchName: "Downtown",
  reservationCode: "RES-9",
  partySize: 2,
  reservationDate: "September 28, 2026",
  reservationTime: "7:30 PM",
  tableName: "12",
};

describe("email personalize helpers", () => {
  it("never renders undefined/null names", () => {
    expect(safeName(undefined)).toBe("there");
    expect(safeName("null")).toBe("there");
    expect(safeName("Ada")).toBe("Ada");
    expect(safeValue(null)).toBe("—");
    expect(escapeHtml("<b>x</b>")).toBe("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("auth email templates", () => {
  it("renders signup OTP with code, subject, html and text", () => {
    const rendered = renderSignupOtpEmail({
      fullName: "Ada",
      code: "482176",
      expiryMinutes: 5,
    });
    expect(rendered.subject).toContain("Verify your email");
    expect(rendered.html).toContain("482176");
    expect(rendered.html).not.toContain("undefined");
    expect(rendered.text).toContain("482176");
    expect(rendered.text).toContain("5 minutes");
  });

  it("falls back when optional name is missing", () => {
    const rendered = renderSignupOtpEmail({
      code: "111111",
      expiryMinutes: 5,
    });
    expect(rendered.html).toContain("Hi there");
    expect(rendered.html).not.toContain("undefined");
  });
});

describe("notification email templates", () => {
  it("renders every customer notification type to html + text", () => {
    for (const type of CUSTOMER_NOTIFICATION_TYPES) {
      const data = type.startsWith("RESERVATION_")
        ? reservationData
        : queueData;
      const rendered = renderNotificationEmail(type, data);
      expect(rendered.subject.length).toBeGreaterThan(3);
      expect(rendered.html).toContain("<!DOCTYPE html>");
      expect(rendered.html).not.toMatch(/\bundefined\b/);
      expect(rendered.text).not.toMatch(/\bundefined\b/);
      expect(rendered.text.length).toBeGreaterThan(20);
    }
  });

  it("keeps EMAIL channel rich while SMS stays short", () => {
    const email = renderNotificationTemplate("QUEUE_JOINED", "EMAIL", queueData);
    const sms = renderNotificationTemplate("QUEUE_JOINED", "SMS", queueData);
    expect(email.html).toBeTruthy();
    expect(email.html).toContain("A12");
    expect(email.subject).toContain("Flowza Cafe");
    expect(sms.body.length).toBeLessThan(160);
    expect(sms.html).toBeUndefined();
  });

  it("highlights queue called token", () => {
    const rendered = renderNotificationEmail("QUEUE_CALLED", queueData);
    expect(rendered.subject.toLowerCase()).toContain("turn");
    expect(rendered.html).toContain("A12");
    expect(rendered.text.toLowerCase()).toContain("host stand");
  });
});

describe("email preview catalog", () => {
  it("renders every preview id without undefined leaks", () => {
    for (const id of EMAIL_PREVIEW_IDS) {
      const rendered = renderEmailPreview(id);
      expect(rendered.subject).toBeTruthy();
      expect(rendered.html).toContain("Flowza");
      expect(rendered.html).not.toMatch(/\bundefined\b/);
      expect(rendered.text).not.toMatch(/\bundefined\b/);
    }
  });
});
