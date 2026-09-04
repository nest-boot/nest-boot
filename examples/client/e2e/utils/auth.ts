import { expect } from "@playwright/test";
import { waitForEmailUrl } from "./mailpit";
import type { APIRequestContext, Page } from "@playwright/test";

export const testPassword = "correct-horse-battery-staple";
export const e2eAdministratorEmail =
  process.env.E2E_ADMIN_EMAIL ?? "e2e-administrator@example.com";
export const e2eAdministratorPassword =
  process.env.E2E_ADMIN_PASSWORD ?? "e2e-administrator-password";

type TestUser = {
  email: string;
  name: string;
};

export async function registerUser(page: Page, user: TestUser) {
  await page.goto("/auth/register");
  await page.getByTestId("auth-name-input").fill(user.name);
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(testPassword);
  await page.getByTestId("auth-submit").click();

  await completeEmailVerification(page, user.email);

  await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
  await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
}

export async function registerUserByApi(
  request: APIRequestContext,
  user: TestUser,
) {
  const response = await request.post("/api/auth/sign-up/email", {
    data: {
      ...user,
      password: testPassword,
    },
  });
  const body = (await response.json()) as {
    user?: {
      id?: string;
    };
  };

  expect(response.ok()).toBeTruthy();
  expect(body.user?.id).toBeTruthy();

  const verificationUrl = await waitForEmailUrl(
    request,
    user.email,
    "Verify your email address",
  );
  expect((await request.get(verificationUrl)).ok()).toBeTruthy();
  expect(
    (
      await request.post("/api/auth/sign-in/email", {
        data: {
          email: user.email,
          password: testPassword,
        },
      })
    ).ok(),
  ).toBeTruthy();
}

export async function signInAsE2eAdministrator(page: Page) {
  await expect
    .poll(
      async () => {
        const response = await page.request.post("/api/auth/sign-in/email", {
          data: {
            email: e2eAdministratorEmail,
            password: e2eAdministratorPassword,
          },
        });
        return response.status();
      },
      {
        message: "waiting for the E2E administrator seed",
        timeout: 15_000,
      },
    )
    .toBe(200);
}

export async function completeEmailVerification(page: Page, email: string) {
  await expect(page).toHaveURL(/\/auth\/verify-email\?/);
  await expect(page.getByTestId("verify-email-view")).toBeVisible();

  const verificationUrl = await waitForEmailUrl(
    page.request,
    email,
    "Verify your email address",
  );
  await page.goto(verificationUrl);
  await expect(page).toHaveURL(/\/auth\/verify-email\?.*verified=true/);
  await expect(page.getByTestId("verify-email-sign-in")).toBeVisible();
  await page.getByTestId("verify-email-sign-in").click();

  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByTestId("auth-email-input").fill(email);
  await page.getByTestId("auth-password-input").fill(testPassword);
  await page.getByTestId("auth-submit").click();
}
