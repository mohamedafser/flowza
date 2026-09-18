import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public queue PWA caching", () => {
  it("never caches live queue routes or APIs", () => {
    const source = readFileSync(
      resolve(__dirname, "../../next.config.ts"),
      "utf8",
    );
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('url.pathname.includes("/queue")');
    expect(source).toContain('handler: "NetworkOnly"');
    expect(source).toContain("supabase");
  });
});
