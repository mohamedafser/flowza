import { expect, test } from "@playwright/test";

const verifiedEmail = process.env.E2E_AUTH_EMAIL;
const verifiedPassword = process.env.E2E_AUTH_PASSWORD;
const onboardingEmail = process.env.E2E_ONBOARDING_EMAIL;
const onboardingPassword = process.env.E2E_ONBOARDING_PASSWORD;

test.describe("Restaurant & branch settings pages", () => {
  test("restaurant settings route is protected", async ({ page }) => {
    await page.goto("/settings/restaurant");
    await expect(page).toHaveURL(/\/login/);
  });

  test("branches settings route is protected", async ({ page }) => {
    await page.goto("/settings/branches");
    await expect(page).toHaveURL(/\/login/);
  });

  test("onboarding route is protected", async ({ page }) => {
    await page.goto("/onboarding/restaurant");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authenticated restaurant flows", () => {
  test("verified member can open restaurant settings", async ({ page }) => {
    test.skip(
      !verifiedEmail || !verifiedPassword,
      "Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run authenticated e2e.",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(verifiedEmail!);
    await page.getByLabel("Password", { exact: true }).fill(verifiedPassword!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding|settings)/, {
      timeout: 15_000,
    });

    await page.goto("/settings/restaurant");
    await expect(page.getByRole("heading", { name: "Restaurant" })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  });

  test("verified member can open branches settings", async ({ page }) => {
    test.skip(
      !verifiedEmail || !verifiedPassword,
      "Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run authenticated e2e.",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(verifiedEmail!);
    await page.getByLabel("Password", { exact: true }).fill(verifiedPassword!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding|settings)/, {
      timeout: 15_000,
    });

    await page.goto("/settings/branches");
    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("new user without restaurant sees onboarding", async ({ page }) => {
    test.skip(
      !onboardingEmail || !onboardingPassword,
      "Set E2E_ONBOARDING_EMAIL and E2E_ONBOARDING_PASSWORD for onboarding e2e.",
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(onboardingEmail!);
    await page
      .getByLabel("Password", { exact: true })
      .fill(onboardingPassword!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/onboarding\/restaurant/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: /set up your restaurant/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Restaurant name")).toBeVisible();
  });
});
