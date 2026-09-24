import { expect, test } from "@playwright/test";

import { completeEmailVerification, testPassword } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { waitForEmailUrl } from "./utils/mailpit";
import { uniqueSeed } from "./utils/unique";

test.describe("email authentication", () => {
  test("registers and logs in with email and password", async ({
    context,
    page,
  }) => {
    const email = `${uniqueSeed("auth")}@example.com`;

    await page.goto("/auth/register");
    await expect(page.getByTestId("auth-view")).toBeVisible();
    await expect(page.getByTestId("auth-tab-register")).toHaveAttribute(
      "data-active",
    );
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

  test("resets and changes a password through GraphQL", async ({
    page,
    browser,
  }) => {
    const email = `${uniqueSeed("password-flow")}@example.com`;
    const resetPassword = "reset-correct-horse-battery-staple";
    const changedPassword = "changed-correct-horse-battery-staple";

    await page.goto("/auth/register");
    await page.getByTestId("auth-name-input").fill("Password Flow User");
    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(testPassword);
    await page.getByTestId("auth-submit").click();
    await completeEmailVerification(page, email);
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

    await page.getByTestId("topbar-menu-trigger").click();
    await page.getByTestId("sidebar-user-sign-out").click();
    await expect(page).toHaveURL(/\/auth\/login(?:\?.*)?$/);
    await page.getByTestId("auth-forgot-password-link").click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await page.getByTestId("forgot-password-email").fill(email);
    await page.getByTestId("forgot-password-submit").click();
    await expect(
      page.getByText(/If an account exists for that email/),
    ).toBeVisible();

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
    await expect(page.getByText("Your password has been reset")).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).click();

    await page.getByTestId("auth-email-input").fill(email);
    await page.getByTestId("auth-password-input").fill(resetPassword);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

    const otherContext = await browser.newContext();
    try {
      await graphqlRequest(
        otherContext.request,
        `mutation($input: AuthSignInInput!) {
        signIn(input: $input) { token }
      }`,
        { input: { email, password: resetPassword } },
      );
    } finally {
      await otherContext.close();
    }

    await page.goto("/user/security");
    await expect(page.getByTestId("user-security-page")).toBeVisible();
    await expect(page.getByTestId("user-session-row")).toHaveCount(2);
    await expect(
      page.getByTestId("user-link-social-account-github"),
    ).toBeVisible();
    await page.getByTestId("user-current-password").fill(resetPassword);
    await page.getByTestId("user-new-password").fill(changedPassword);
    await page.getByTestId("user-confirm-password").fill(changedPassword);
    await expect(page.getByTestId("user-revoke-other-sessions")).toBeChecked();
    await page.getByTestId("user-change-password-submit").click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByTestId("user-session-row")).toHaveCount(1);
    await expect(
      page.getByText("Current session", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("user-revoke-other-session-list"),
    ).toBeDisabled();

    await page.getByTestId("topbar-menu-trigger").click();
    await page.getByTestId("sidebar-user-sign-out").click();
    await expect(page).toHaveURL(/\/auth\/login$/);
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
      "Verification failed",
    );
    await expect(page.getByTestId("verify-email-sign-in")).toHaveCount(0);
  });

  test("keeps login and registration on canonical routes", async ({ page }) => {
    await page.goto("/auth/login?redirect=%2Fuser%2Fsecurity");
    await expect(page.getByTestId("auth-social-submit-github")).toBeVisible();
    await page.getByTestId("auth-tab-register").click();
    await expect(page).toHaveURL(
      /\/auth\/register\?redirect=%2Fuser%2Fsecurity$/,
    );
    // The URL can change before the destination form has finished rendering.
    await expect(page.getByTestId("auth-name-input")).toBeVisible();

    await page.getByTestId("auth-tab-login").click();
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fuser%2Fsecurity$/);
    await expect(page.getByTestId("auth-name-input")).toHaveCount(0);
  });

  test("starts configured social login through GraphQL", async ({
    page,
    baseURL,
  }) => {
    await page.route("**/api/graphql", async (route) => {
      const request = route.request();
      const body = request.postDataJSON() as {
        operationName?: string;
        variables?: {
          input?: {
            callbackURL?: string;
            errorCallbackURL?: string;
            provider?: string;
          };
        };
      };

      if (body.operationName !== "signInSocialFromLoginForm") {
        await route.continue();
        return;
      }

      expect(body.variables?.input).toMatchObject({
        callbackURL: new URL("/user/security", baseURL).href,
        errorCallbackURL: new URL(
          "/auth/login?redirect=%2Fuser%2Fsecurity",
          baseURL,
        ).href,
        provider: "github",
      });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            signInSocial: {
              redirect: true,
              url: new URL("/auth/forgot-password", baseURL).href,
            },
          },
        }),
      });
    });

    await page.goto("/auth/login?redirect=%2Fuser%2Fsecurity");
    await page.getByTestId("auth-social-submit-github").click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
  });
});
