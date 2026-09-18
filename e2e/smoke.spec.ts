import { expect, test } from "@playwright/test";

test.describe("Flowza smoke", () => {
  test("home page loads with brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Flowza" })).toBeVisible();
    await expect(
      page.getByText("Simplify the flow of your business."),
    ).toBeVisible();
  });

  test("health API responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  test("PWA manifest is available", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      name: string;
      display: string;
      icons: unknown[];
    };
    expect(body.name).toBe("Flowza");
    expect(body.display).toBe("standalone");
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test("auth pages load", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page
        .getByRole("heading", { name: "Log in" })
        .or(page.getByText("Log in").first()),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

    await page.goto("/signup");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible();

    await page.goto("/forgot-password");
    await expect(page.getByText("Forgot password")).toBeVisible();
  });

  test("protected dashboard redirects unauthenticated users", async ({
    page,
  }) => {
    await page.goto("/dashboard/overview");
    await expect(page).toHaveURL(/\/login/);
  });

  test("protected settings redirects unauthenticated users", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
