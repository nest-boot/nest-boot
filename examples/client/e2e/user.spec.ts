import { expect, test } from "@playwright/test";

import { registerUser, testPassword } from "./utils/auth";
import { waitForEmailUrl } from "./utils/mailpit";
import { uniqueSeed } from "./utils/unique";
import { createFirstWorkspace } from "./utils/workspace";

test.describe("user pages", () => {
  test("manages the profile and navigates personal resources", async ({
    page,
  }) => {
    const seed = uniqueSeed("user-pages");
    const email = `${seed}@example.com`;
    const newEmail = `${seed}-changed@example.com`;
    const workspaceName = `个人工作空间 ${seed}`;
    const updatedName = `Updated User ${seed}`;

    await registerUser(page, {
      email,
      name: `User ${seed}`,
    });
    await createFirstWorkspace(page, workspaceName);

    await page.getByTestId("sidebar-user-menu").click();
    await page.getByTestId("sidebar-user-account-link").click();

    await expect(page).toHaveURL(/\/user$/);
    await expect(page.getByTestId("user-profile-page")).toBeVisible();

    const nameInput = page.getByTestId("user-profile-name-input");
    await nameInput.fill(updatedName);
    await page.getByTestId("user-profile-save").click();
    await expect(nameInput).toHaveValue(updatedName);

    await page.reload();
    await expect(nameInput).toHaveValue(updatedName);

    await page.getByTestId("user-new-email-input").fill(newEmail);
    await page.getByTestId("user-change-email-submit").click();
    await expect(page.getByText("确认邮件已发送至当前邮箱")).toBeVisible();

    const confirmationUrl = await waitForEmailUrl(
      page.request,
      email,
      "Confirm your email change",
    );
    await page.goto(confirmationUrl);
    await expect(page).toHaveURL(/\/user\?emailChangeCallback=true/);
    await expect(page.getByTestId("user-email-confirmed-alert")).toBeVisible();

    const verificationUrl = await waitForEmailUrl(
      page.request,
      newEmail,
      "Verify your email address",
    );
    await page.goto(verificationUrl);
    await expect(page).toHaveURL(/\/user\?emailChangeCallback=true/);
    await expect(page.getByTestId("user-email-changed-alert")).toBeVisible();
    await expect(page.getByTestId("user-current-email")).toHaveValue(newEmail);

    await page.getByTestId("user-sidebar-workspaces-link").click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();

    await page.getByTestId("user-sidebar-api-keys-link").click();
    await expect(page).toHaveURL(/\/user\/api-keys(?:\?.*)?$/);
    await expect(page.getByTestId("api-keys-page")).toBeVisible();
  });

  test("lists active sessions and signs out other devices", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("user-sessions");
    const email = `${seed}@example.com`;

    await registerUser(page, {
      email,
      name: `Session User ${seed}`,
    });

    const otherContext = await browser.newContext({
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
    });
    const otherPage = await otherContext.newPage();

    try {
      await otherPage.goto("/auth/login");
      await otherPage.getByTestId("auth-email-input").fill(email);
      await otherPage.getByTestId("auth-password-input").fill(testPassword);
      await otherPage.getByTestId("auth-submit").click();
      await expect(otherPage).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

      await page.goto("/user/security");
      await expect(page.getByTestId("user-session-row")).toHaveCount(2);
      await expect(page.getByText("当前会话", { exact: true })).toHaveCount(1);

      await page.getByTestId("user-revoke-other-session-list").click();
      await expect(page.getByTestId("user-session-row")).toHaveCount(1);
      await expect(page.getByText("其他会话已退出")).toBeVisible();

      await otherPage.goto("/user");
      await expect(otherPage).toHaveURL(/\/auth\/login/);
    } finally {
      await otherContext.close();
    }
  });
});
