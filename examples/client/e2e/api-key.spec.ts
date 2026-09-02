import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";
import { createFirstWorkspace } from "./utils/workspace";

test.describe("workspace API keys", () => {
  test("creates, reveals once, renames, and deletes an API key from the UI", async ({
    page,
  }) => {
    const seed = uniqueSeed("api-key");
    const workspaceName = `API Key 工作空间 ${seed}`;
    const apiKeyName = `部署密钥 ${seed}`;
    const renamedApiKeyName = `重命名密钥 ${seed}`;

    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "API Key Owner",
    });

    const workspaceId = await createFirstWorkspace(page, workspaceName);

    await page.getByTestId("workspace-sidebar-api-keys-link").click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/api-keys(\\?.*)?$`),
    );
    await expect(page.getByTestId("api-keys-page")).toBeVisible();

    await page.getByTestId("api-key-create-action").click();
    await page.getByTestId("api-key-name-input").fill(apiKeyName);
    await page.getByTestId("api-key-create-submit").click();

    const revealedKey = page.getByTestId("api-key-created-value");
    await expect(revealedKey).toContainText(/^sk-/);
    await page.getByTestId("api-key-created-close").click();

    const row = page.getByRole("row").filter({ hasText: apiKeyName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("sk-");

    await row.getByRole("button").click();
    await page.getByRole("menuitem", { name: "重命名" }).click();
    await page.getByTestId("api-key-rename-input").fill(renamedApiKeyName);
    await page.getByTestId("api-key-rename-submit").click();

    const renamedRow = page
      .getByRole("row")
      .filter({ hasText: renamedApiKeyName });
    await expect(renamedRow).toBeVisible();

    await renamedRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByTestId("alert-dialog-confirm").click();
    await expect(renamedRow).not.toBeVisible();
  });
});
