import { expect, test } from "@playwright/test";

import { testPassword } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";

test.describe("email authentication", () => {
  test("registers and logs in with email and password", async ({
    context,
    page,
  }) => {
    const email = `${uniqueSeed("auth")}@example.com`;

    await page.goto("/auth/login");
    await expect(page.getByTestId("auth-view")).toBeVisible();

    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("auth-name-input").fill("Playwright User");
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(testPassword);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.getByTestId("workspace-empty-state")).toBeVisible();

    await context.clearCookies();
    await page.goto("/auth/login");
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(testPassword);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.getByTestId("workspace-empty-state")).toBeVisible();
  });
});
