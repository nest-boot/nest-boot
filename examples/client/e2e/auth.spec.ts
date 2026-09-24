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
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText("Welcome back", { exact: true }) }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Register", exact: true }),
    ).toHaveAttribute("data-active");
    await page.getByLabel("Name", { exact: true }).fill("Playwright User");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);
    await page
      .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
      .click();

    await expect(
      page.locator('[data-slot="card"]').filter({
        has: page.getByText(
          /^(Check your email|Email verified|Verification failed)$/,
        ),
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Resend verification email", exact: true })
      .click();
    await expect(
      page.getByText("A new verification email has been sent.", {
        exact: true,
      }),
    ).toBeVisible();
    await completeEmailVerification(page, email);

    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Workspaces", exact: true }),
    ).toBeVisible();

    await context.clearCookies();
    await page.goto("/auth/login");
    await expect(
      page.getByRole("checkbox", { name: "Remember me", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("checkbox", { name: "Remember me", exact: true })
      .uncheck();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);
    await page
      .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
      .click();

    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Workspaces", exact: true }),
    ).toBeVisible();
  });

  test("resets and changes a password through GraphQL", async ({
    page,
    browser,
  }) => {
    const email = `${uniqueSeed("password-flow")}@example.com`;
    const resetPassword = "reset-correct-horse-battery-staple";
    const changedPassword = "changed-correct-horse-battery-staple";

    await page.goto("/auth/register");
    await page.getByLabel("Name", { exact: true }).fill("Password Flow User");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);
    await page
      .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
      .click();
    await completeEmailVerification(page, email);
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login(?:\?.*)?$/);
    await page
      .getByRole("link", { name: "Forgot password?", exact: true })
      .click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Forgot your password?", { exact: true }) })
      .getByLabel("Email", { exact: true })
      .fill(email);
    await page
      .getByRole("button", { name: "Send reset link", exact: true })
      .click();
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
    await page.getByLabel("New password", { exact: true }).fill(resetPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(resetPassword);
    await page
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(page.getByText("Your password has been reset")).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).click();

    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(resetPassword);
    await page
      .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
      .click();
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
    await expect(
      page.getByRole("heading", { name: "Security", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText("Active sessions", { exact: true }) })
        .getByRole("listitem"),
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Link GitHub", exact: true }),
    ).toBeVisible();
    await page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Change password", { exact: true }) })
      .getByLabel("Current password", { exact: true })
      .fill(resetPassword);
    await page
      .getByLabel("New password", { exact: true })
      .fill(changedPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(changedPassword);
    await expect(
      page.getByRole("checkbox", {
        name: "Sign out other sessions",
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByText("Active sessions", { exact: true }) })
        .getByRole("listitem"),
    ).toHaveCount(1);
    await expect(
      page.getByText("Current session", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: "Sign out other sessions",
        exact: true,
      }),
    ).toBeDisabled();

    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(resetPassword);
    await page
      .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
      .click();
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.getByLabel("Password", { exact: true }).fill(changedPassword);
    await page
      .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
      .click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
  });

  test("shows an invalid email-verification callback", async ({ page }) => {
    await page.goto("/auth/verify-email?error=invalid_token");

    await expect(
      page.locator('[data-slot="card"]').filter({
        has: page.getByText(
          /^(Check your email|Email verified|Verification failed)$/,
        ),
      }),
    ).toContainText("Verification failed");
    await expect(
      page.getByRole("link", { name: "Continue to sign in", exact: true }),
    ).toHaveCount(0);
  });

  test("keeps login and registration on canonical routes", async ({ page }) => {
    await page.goto("/auth/login?redirect=%2Fuser%2Fsecurity");
    await expect(
      page.getByRole("button", { name: "Continue with GitHub", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Register", exact: true }).click();
    await expect(page).toHaveURL(
      /\/auth\/register\?redirect=%2Fuser%2Fsecurity$/,
    );
    // The URL can change before the destination form has finished rendering.
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fuser%2Fsecurity$/);
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
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
    await page
      .getByRole("button", { name: "Continue with GitHub", exact: true })
      .click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
  });
});
