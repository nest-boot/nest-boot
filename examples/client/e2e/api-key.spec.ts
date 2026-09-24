import { expect, test } from "@playwright/test";
import { getPermissionCheckbox } from "./utils/permissions";

import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import {
  addMemberByApi,
  createFirstWorkspace,
  createWorkspaceByApi,
} from "./utils/workspace";
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
              "WORKSPACE_API_KEY__READ",
              "WORKSPACE_API_KEY__WRITE",
              "WORKSPACE__UPDATE",
            ],
          },
        },
        { "x-workspace-id": workspaceId },
      );
      await issuerPage.goto(`/workspaces/${workspaceId}/api-keys`);
      await issuerPage
        .getByRole("button", { name: "Create API Key", exact: true })
        .click();
      await expect(
        issuerPage.getByRole("checkbox", {
          name: "Update Workspace",
          exact: true,
        }),
      ).not.toBeChecked();
      await issuerPage
        .getByRole("checkbox", { name: "Update Workspace", exact: true })
        .click();
      for (const permission of [
        "WORKSPACE__DELETE",
        "MEMBER__WRITE",
        "MEMBER__INVITE",
      ]) {
        await expect(
          getPermissionCheckbox(issuerPage, permission),
        ).toBeDisabled();
        await expect(
          getPermissionCheckbox(issuerPage, permission),
        ).not.toBeChecked();
      }
      await issuerPage
        .getByLabel("Name", { exact: true })
        .fill(`Limited key ${seed}`);
      await issuerPage
        .getByRole("button", { name: "Create", exact: true })
        .click();
      await expect(issuerPage.getByRole("code")).toContainText(
        /^sk[A-Za-z0-9_-]{64}$/,
      );
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

    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: "API Keys", exact: true })
      .click();
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
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^Open profile:/ }).click();
    await page
      .locator('[data-slot="sidebar"]')
      .filter({ has: page.getByText("Personal", { exact: true }) })
      .getByRole("link", { name: "API Keys", exact: true })
      .click();

    await expect(page).toHaveURL(/\/user\/api-keys(\?.*)?$/);

    await exerciseApiKeyLifecycle(page, {
      name: `个人密钥 ${seed}`,
      renamedName: `重命名个人密钥 ${seed}`,
    });
  });

  test("scopes direct detail URLs to their owner and workspace", async ({
    page,
    browser,
  }) => {
    const seed = uniqueSeed("api-key-detail-scope");
    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Scoped key owner",
    });
    const workspaceId = await createFirstWorkspace(page, seed);
    const otherWorkspace = await createWorkspaceByApi(page, `${seed}-other`);
    const { createWorkspaceApiKey: workspaceKey } = await graphqlRequest<{
      createWorkspaceApiKey: { entity: { id: string } };
    }>(
      page.request,
      `mutation {
      createWorkspaceApiKey(input: { name: "Workspace scoped key", permissions: [] }) { entity { id } }
    }`,
      {},
      { "x-workspace-id": workspaceId },
    );
    const { createUserApiKey: userKey } = await graphqlRequest<{
      createUserApiKey: { entity: { id: string } };
    }>(
      page.request,
      `mutation {
      createUserApiKey(input: { name: "User scoped key", permissions: [] }) { entity { id } }
    }`,
    );
    await page.goto(
      `/workspaces/${workspaceId}/api-keys/${workspaceKey.entity.id}`,
    );
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Workspace scoped key",
    );
    await page.goto(
      `/workspaces/${otherWorkspace.id}/api-keys/${workspaceKey.entity.id}`,
    );
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${otherWorkspace.id}/api-keys(?:\\?.*)?$`),
    );
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await page.goto(`/user/api-keys/${workspaceKey.entity.id}`);
    await expect(page).toHaveURL(/\/user\/api-keys(\?.*)?$/);
    await page.goto(`/workspaces/${workspaceId}/api-keys/${userKey.entity.id}`);
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/api-keys(?:\\?.*)?$`),
    );

    const otherContext = await browser.newContext();
    try {
      const otherPage = await otherContext.newPage();
      await registerUser(otherPage, {
        email: `${seed}-other@example.com`,
        name: "Other key owner",
      });
      await otherPage.goto(`/user/api-keys/${userKey.entity.id}`);
      await expect(otherPage).toHaveURL(/\/user\/api-keys(\?.*)?$/);
      await expect(otherPage.getByLabel("Name", { exact: true })).toHaveCount(
        0,
      );
    } finally {
      await otherContext.close();
    }
  });
});

async function exerciseApiKeyLifecycle(
  page: Page,
  names: { name: string; renamedName: string },
) {
  const listUrl = new URL(page.url());
  listUrl.search = "";
  const scope = page.url().includes("/workspaces/") ? "WORKSPACE" : "USER";
  await expect(
    page.getByRole("heading", { name: "API Keys", exact: true }),
  ).toBeVisible();
  if (scope === "USER") await page.setViewportSize({ width: 390, height: 844 });

  await page
    .getByRole("button", { name: "Create API Key", exact: true })
    .click();
  await expect(page).toHaveURL(`${listUrl}/create`);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByLabel("Name", { exact: true }).press("Enter");
  await expect(
    page.getByText("API key name is required", { exact: true }),
  ).toBeVisible();
  const invitationPermission = page.getByRole("checkbox", {
    name: "Manage Member Invitations",
    exact: true,
  });
  await expect(invitationPermission).not.toBeChecked();
  await expect(invitationPermission).toBeEnabled();
  await page.getByLabel("Name", { exact: true }).fill(names.name);
  for (const action of ["read", "write"]) {
    const permission = getPermissionCheckbox(
      page,
      `${scope}_API_KEY__${action.toUpperCase()}`,
    );
    await expect(permission).toBeVisible();
    await expect(permission).not.toBeChecked();
    await permission.click();
    await expect(permission).toBeChecked();
  }
  await page.getByRole("button", { name: "Create", exact: true }).click();

  const revealedKey = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("API Key Created", { exact: true }) })
    .getByRole("code");
  await expect(revealedKey).toContainText(/^sk[A-Za-z0-9_-]{64}$/);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy API Key", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  const secret = await revealedKey.textContent();
  expect(
    await page.evaluate(
      async (value) => (await navigator.clipboard.readText()) === value,
      secret,
    ),
  ).toBe(true);
  expect(page.url()).not.toContain(secret!);
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "API Keys", exact: true })
    .click();
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await expect(revealedKey).toHaveCount(0);

  const row = page.getByRole("row").filter({ hasText: names.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("sk");

  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Disable" }).click();
  await expect(row).toContainText("Disabled");

  const detailPath = await row
    .getByRole("link", { name: names.name, exact: true })
    .getAttribute("href");
  // A non-link cell opens the same detail route as the name link.
  await row.getByRole("cell").nth(2).click();
  await expect(page).toHaveURL(new URL(detailPath!, listUrl).href);
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    names.name,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(revealedKey).toHaveCount(0);
  for (const action of ["read", "write"]) {
    await expect(
      getPermissionCheckbox(page, `${scope}_API_KEY__${action.toUpperCase()}`),
    ).toBeChecked();
  }
  await page.getByLabel("Name", { exact: true }).fill(names.renamedName);
  await getPermissionCheckbox(page, `${scope}_API_KEY__WRITE`).click();
  await page.getByLabel("Name", { exact: true }).press("Enter");
  await expect(
    page.getByText("API key updated", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    names.renamedName,
  );
  await expect(
    getPermissionCheckbox(page, `${scope}_API_KEY__WRITE`),
  ).not.toBeChecked();
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "API Keys", exact: true })
    .click();

  const renamedRow = page
    .getByRole("row")
    .filter({ hasText: names.renamedName });
  await expect(renamedRow).toBeVisible();

  await renamedRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(renamedRow).not.toBeVisible();
  // Deleted and invalid IDs do not render an editor or stale cached data.
  await page.goto(detailPath!);
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await page.goto(`${listUrl}/000000000000000001`);
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await page.goto(`${listUrl}/create`);
  await expect(revealedKey).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
}
