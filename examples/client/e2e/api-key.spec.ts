import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { addMemberByApi, createFirstWorkspace } from "./utils/workspace";
import type { Page } from "@playwright/test";

test.describe("API keys", () => {
  test("limits workspace-key selections and defaults to the issuer's grants", async ({
    page,
    browser,
  }) => {
    const seed = uniqueSeed("limited-workspace-key");
    await registerUser(page, {
      email: `${seed}-owner@example.com`,
      name: "Key Owner",
    });
    const workspaceId = await createFirstWorkspace(
      page,
      `Limited keys ${seed}`,
    );
    const issuerContext = await browser.newContext();
    try {
      const issuerPage = await issuerContext.newPage();
      const email = `${seed}-issuer@example.com`;
      await registerUser(issuerPage, { email, name: "Limited Key Issuer" });
      const id = await addMemberByApi(page, workspaceId, email);
      await graphqlRequest(
        page.request,
        `mutation ($id: ID!, $input: SetMemberPermissionsInput!) {
        setMemberPermissions(id: $id, input: $input) { id }
      }`,
        {
          id,
          input: {
            permissions: [
              "API_KEY__READ",
              "API_KEY__CREATE",
              "WORKSPACE__UPDATE",
            ],
          },
        },
        { "x-workspace-id": workspaceId },
      );
      await issuerPage.goto(`/workspaces/${workspaceId}/api-keys`);
      await issuerPage.getByTestId("api-key-create-action").click();
      await expect(
        issuerPage.getByTestId("permission-WORKSPACE__UPDATE"),
      ).toBeChecked();
      for (const permission of [
        "WORKSPACE__DELETE",
        "MEMBER__UPDATE",
        "INVITATION__CREATE",
      ]) {
        await expect(
          issuerPage.getByTestId(`permission-${permission}`),
        ).toBeDisabled();
        await expect(
          issuerPage.getByTestId(`permission-${permission}`),
        ).not.toBeChecked();
      }
      await issuerPage
        .getByTestId("api-key-name-input")
        .fill(`Limited key ${seed}`);
      await issuerPage.getByTestId("api-key-create-submit").click();
      await expect(
        issuerPage.getByTestId("api-key-created-value"),
      ).toContainText(/^sk[A-Za-z0-9_-]{64}$/);
    } finally {
      await issuerContext.close();
    }
  });

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
  const invitationPermission = page.getByTestId(
    "permission-INVITATION__CREATE",
  );
  if (page.url().includes("/workspaces/")) {
    await expect(invitationPermission).not.toBeChecked();
    await expect(invitationPermission).toBeDisabled();
  } else {
    await expect(invitationPermission).toBeChecked();
    await expect(invitationPermission).toBeEnabled();
  }
  await page.getByTestId("api-key-name-input").fill(names.name);
  for (const action of ["read", "create", "update", "delete"]) {
    const permission = page.getByTestId(
      `permission-API_KEY__${action.toUpperCase()}`,
    );
    await expect(permission).toBeVisible();
    await expect(permission).not.toBeChecked();
    await permission.click();
    await expect(permission).toBeChecked();
  }
  await page.getByTestId("api-key-create-submit").click();

  const revealedKey = page.getByTestId("api-key-created-value");
  await expect(revealedKey).toContainText(/^sk[A-Za-z0-9_-]{64}$/);
  await page.getByTestId("api-key-created-close").click();

  const row = page.getByRole("row").filter({ hasText: names.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("sk");

  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "禁用" }).click();
  await expect(row).toContainText("已禁用");

  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "编辑" }).click();
  for (const action of ["read", "create", "update", "delete"]) {
    await expect(
      page.getByTestId(`permission-API_KEY__${action.toUpperCase()}`),
    ).toBeChecked();
  }
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
