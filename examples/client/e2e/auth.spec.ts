import { expect, test } from "@playwright/test";

import { graphqlRequest } from "./utils/graphql";
import { completeEmailVerification, testPassword } from "./utils/auth";
import { waitForEmailUrl } from "./utils/mailpit";
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

    await expect(page.getByTestId("verify-email-view")).toBeVisible();
    await page.getByTestId("verify-email-resend").click();
    await expect(page.getByTestId("verify-email-resent")).toBeVisible();
    await completeEmailVerification(page, email);

    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(page.getByTestId("user-workspaces-page")).toBeVisible();

    await context.clearCookies();
    await page.goto("/auth/login");
    await expect(page.getByTestId("auth-remember-me")).toBeChecked();
    await page.getByTestId("auth-remember-me").uncheck();
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(testPassword);
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
  });

  test("resets and changes a password through GraphQL", async ({ page }) => {
    const email = `${uniqueSeed("password-flow")}@example.com`;
    const resetPassword = "reset-correct-horse-battery-staple";
    const changedPassword = "changed-correct-horse-battery-staple";

    await page.goto("/auth/login");
    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("auth-name-input").fill("Password Flow User");
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(testPassword);
    await page.getByTestId("auth-submit").click();
    await completeEmailVerification(page, email);
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

    await graphqlRequest(
      page.request,
      /* GraphQL */ `
        mutation {
          authSignOut
        }
      `,
    );
    await page.goto("/auth/login");
    await page.getByTestId("auth-forgot-password-link").click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await page.getByTestId("forgot-password-email").fill(email);
    await page.getByTestId("forgot-password-submit").click();
    await expect(page.getByText(/如果该邮箱对应的账户存在/)).toBeVisible();

    const passwordResetUrl = await waitForEmailUrl(
      page.request,
      email,
      "Reset your password",
    );
    await page.goto(passwordResetUrl);
    await expect(page).toHaveURL(/\/auth\/reset-password\?token=/);
    await page.getByTestId("reset-password-new").fill(resetPassword);
    await page.getByTestId("reset-password-confirm").fill(resetPassword);
    await page.getByTestId("reset-password-submit").click();
    await expect(page.getByText("密码已重置")).toBeVisible();
    await page.getByRole("link", { name: "登录" }).click();

    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(resetPassword);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

    await page.goto("/user/security");
    await expect(page.getByTestId("user-security-page")).toBeVisible();
    await page.getByTestId("user-current-password").fill(resetPassword);
    await page.getByTestId("user-new-password").fill(changedPassword);
    await page.getByTestId("user-confirm-password").fill(changedPassword);
    await expect(page.getByTestId("user-revoke-other-sessions")).toBeChecked();
    await page.getByTestId("user-change-password-submit").click();
    await expect(page.getByText("密码已修改")).toBeVisible();

    await graphqlRequest(
      page.request,
      /* GraphQL */ `
        mutation {
          authSignOut
        }
      `,
    );
    await page.goto("/auth/login");
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(resetPassword);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.getByTestId("auth-password-input").fill(changedPassword);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
  });

  test("shows an invalid email-verification callback", async ({ page }) => {
    await page.goto("/auth/verify-email?error=invalid_token");

    await expect(page.getByTestId("verify-email-view")).toContainText(
      "验证失败",
    );
    await expect(page.getByTestId("verify-email-sign-in")).toHaveCount(0);
  });
});
