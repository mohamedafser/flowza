import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("exposes required installable fields", () => {
    const data = manifest();

    expect(data.name).toBe("Flowza");
    expect(data.short_name).toBe("Flowza");
    expect(data.display).toBe("standalone");
    expect(data.start_url).toBe("/");
    expect(data.icons?.length).toBeGreaterThan(0);
    expect(data.icons?.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(data.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
  });
});
