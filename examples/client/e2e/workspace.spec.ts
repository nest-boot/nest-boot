import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { createFirstWorkspace } from "./utils/workspace";
import { uniqueSeed } from "./utils/unique";

test.describe("workspace management", () => {
  test("creates, renames, and deletes a workspace from the UI", async ({
    page,
  }) => {
    const seed = uniqueSeed("workspace");
    const workspaceName = `前端工作空间 ${seed}`;
    const renamedWorkspaceName = `重命名工作空间 ${seed}`;

    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Workspace Owner",
    });

    await createFirstWorkspace(page, workspaceName);

    const nameInput = page.getByTestId("workspace-settings-name-input");
    await expect(nameInput).toHaveValue(workspaceName);

    await nameInput.fill(renamedWorkspaceName);
    await page.getByTestId("workspace-settings-save").click();
    await expect(nameInput).toHaveValue(renamedWorkspaceName);

    await page.reload();
    await expect(nameInput).toHaveValue(renamedWorkspaceName);

    await page.getByTestId("workspace-settings-delete").click();
    await page.getByTestId("alert-dialog-confirm").click();

    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.getByTestId("workspace-empty-state")).toBeVisible();
  });
});
