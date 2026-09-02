import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";
import { createFirstWorkspace } from "./utils/workspace";
import type { Page } from "@playwright/test";

test.describe("API keys", () => {
  test("manages a workspace-owned API key", async ({ page }) => {
    const seed = uniqueSeed("workspace-api-key");

    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Workspace API Key Owner",
    });

    const workspaceId = await createFirstWorkspace(
      page,
      `API Key 工作空间 ${seed}`,
    );

    await page.getByTestId("workspace-sidebar-api-keys-link").click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/api-keys(\\?.*)?$`),
    );

    await exerciseApiKeyLifecycle(page, {
      name: `工作空间密钥 ${seed}`,
      renamedName: `重命名工作空间密钥 ${seed}`,
    });
  });

  test("manages a user-owned API key", async ({ page }) => {
    const seed = uniqueSeed("user-api-key");

    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "User API Key Owner",
    });

    await createFirstWorkspace(page, `个人 Key 工作空间 ${seed}`);
    await page.getByTestId("sidebar-user-menu").click();
    await page.getByTestId("sidebar-user-api-keys-link").click();

    await expect(page).toHaveURL(/\/user\/api-keys(\?.*)?$/);

    await exerciseApiKeyLifecycle(page, {
      name: `个人密钥 ${seed}`,
      renamedName: `重命名个人密钥 ${seed}`,
    });
  });
});

async function exerciseApiKeyLifecycle(
  page: Page,
  names: { name: string; renamedName: string },
) {
  await expect(page.getByTestId("api-keys-page")).toBeVisible();

  await page.getByTestId("api-key-create-action").click();
  await page.getByTestId("api-key-name-input").fill(names.name);
  await page.getByTestId("api-key-create-submit").click();

  const revealedKey = page.getByTestId("api-key-created-value");
  await expect(revealedKey).toContainText(/^sk-/);
  await page.getByTestId("api-key-created-close").click();

  const row = page.getByRole("row").filter({ hasText: names.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("sk-");

  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "禁用" }).click();
  await expect(row).toContainText("已禁用");

  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "编辑" }).click();
  await page.getByTestId("api-key-rename-input").fill(names.renamedName);
  await page.getByTestId("api-key-rename-submit").click();

  const renamedRow = page
    .getByRole("row")
    .filter({ hasText: names.renamedName });
  await expect(renamedRow).toBeVisible();

  await renamedRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "删除" }).click();
  await page.getByTestId("alert-dialog-confirm").click();
  await expect(renamedRow).not.toBeVisible();
}
