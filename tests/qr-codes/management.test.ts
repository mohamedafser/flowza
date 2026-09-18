import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("QR management surface", () => {
  it("exposes dashboard QR board with preview/download/print actions", () => {
    const board = readFileSync(
      resolve(__dirname, "../../components/qr-codes/QRBoard.tsx"),
      "utf8",
    );
    expect(board).toContain("Create QR code");
    expect(board).toContain("Preview");
    expect(board).toContain("Download");
    expect(board).toContain("Print");
    expect(board).toContain("Regenerate QR");
    expect(board).toContain("Deactivate");
    expect(board).toContain("Copied");
  });

  it("warns before destination changes on edit", () => {
    const form = readFileSync(
      resolve(__dirname, "../../components/qr-codes/QRFormDialog.tsx"),
      "utf8",
    );
    expect(form).toContain("Existing printed copies will use the updated");
  });

  it("uses a print-friendly layout without internal ids", () => {
    const printView = readFileSync(
      resolve(__dirname, "../../components/qr-codes/QRPrintView.tsx"),
      "utf8",
    );
    expect(printView).toContain("qr-print-sheet");
    expect(printView).toContain("PUBLIC_QR_MESSAGES.scanToJoin");
    expect(printView).not.toContain("qrCode.id");
    expect(printView).not.toMatch(/customer|phone|email/i);
  });

  it("public page redirects active QR to Phase 9 join path", () => {
    const page = readFileSync(
      resolve(__dirname, "../../app/(public)/qr/[publicToken]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("redirect(result.data.joinPath)");
    expect(page).toContain("PublicQRUnavailable");
  });

  it("service regenerates tokens separately from normal edits", () => {
    const service = readFileSync(
      resolve(__dirname, "../../services/qr-codes.ts"),
      "utf8",
    );
    expect(service).toContain("regenerateQRCodeToken");
    expect(service).toContain("qr_code.token_regenerated");
    expect(service).toContain("generate_qr_public_token");
    // Normal update must not rotate the token
    const updateFn = service.slice(
      service.indexOf("export async function updateQRCode"),
      service.indexOf("export async function activateQRCode"),
    );
    expect(updateFn).not.toContain("generate_qr_public_token");
  });
});
