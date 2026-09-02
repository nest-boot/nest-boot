import { expect } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export const testPassword = "correct-horse-battery-staple";

type TestUser = {
  email: string;
  name: string;
};

export async function registerUser(page: Page, user: TestUser) {
  await page.goto("/auth/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-name-input").fill(user.name);
  await page.getByTestId("auth-email-input").fill(user.email);
  await page.getByTestId("auth-password-input").fill(testPassword);
  await page.getByTestId("auth-submit").click();

  await expect(page).toHaveURL(/\/workspaces$/);
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
}
