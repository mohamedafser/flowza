import { expect, test } from "@playwright/test";

const verifiedEmail = process.env.E2E_AUTH_EMAIL;
const verifiedPassword = process.env.E2E_AUTH_PASSWORD;
const unverifiedEmail = process.env.E2E_UNVERIFIED_EMAIL;
const unverifiedPassword = process.env.E2E_UNVERIFIED_PASSWORD;

test.describe("Authentication pages", () => {
  test("login page shows form controls", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toBeVisible();
  });

  test("signup page shows form controls", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Forgot password")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send reset link|send/i }),
    ).toBeVisible();
  });

  test("signup client validation blocks weak passwords", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Test User");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm password").fill("short");
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("protected dashboard redirects unauthenticated users", async ({
    page,
  }) => {
    await page.goto("/dashboard/overview");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authenticated flows", () => {
  test("verified user can access dashboard", async ({ page }) => {
    test.skip(
      !verifiedEmail || !verifiedPassword,
      "Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run authenticated e2e.",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(verifiedEmail!);
    await page.getByLabel("Password", { exact: true }).fill(verifiedPassword!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("unverified user is redirected to verification", async ({ page }) => {
    test.skip(
      !unverifiedEmail || !unverifiedPassword,
      "Set E2E_UNVERIFIED_EMAIL and E2E_UNVERIFIED_PASSWORD to run unverified e2e.",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(unverifiedEmail!);
    await page
      .getByLabel("Password", { exact: true })
      .fill(unverifiedPassword!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });

    await page.goto("/dashboard/overview");
    await expect(page).toHaveURL(/\/verify-email/);
  });
});
