import { expect, test } from "@playwright/test";

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
      await issuerPage.getByTestId("api-key-create-action").click();
      await expect(
        issuerPage.getByTestId("permission-WORKSPACE__UPDATE"),
      ).not.toBeChecked();
      await issuerPage.getByTestId("permission-WORKSPACE__UPDATE").click();
      for (const permission of [
        "WORKSPACE__DELETE",
        "MEMBER__WRITE",
        "MEMBER__INVITE",
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
    await page.getByTestId("topbar-menu-trigger").click();
    await page.getByTestId("sidebar-user-account-link").click();
    await page.getByTestId("user-sidebar-api-keys-link").click();

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
    await expect(page.getByTestId("api-key-rename-input")).toHaveValue(
      "Workspace scoped key",
    );
    await page.goto(
      `/workspaces/${otherWorkspace.id}/api-keys/${workspaceKey.entity.id}`,
    );
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${otherWorkspace.id}/api-keys(?:\\?.*)?$`),
    );
    await expect(page.getByTestId("api-key-rename-input")).toHaveCount(0);
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
      await expect(otherPage.getByTestId("api-key-rename-input")).toHaveCount(
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
  await expect(page.getByTestId("api-keys-page")).toBeVisible();
  if (scope === "USER") await page.setViewportSize({ width: 390, height: 844 });

  await page.getByTestId("api-key-create-action").click();
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
  await page.getByTestId("api-key-name-input").press("Enter");
  await expect(
    page.getByText("API 密钥名称是必填的", { exact: true }),
  ).toBeVisible();
  const invitationPermission = page.getByTestId("permission-MEMBER__INVITE");
  await expect(invitationPermission).not.toBeChecked();
  await expect(invitationPermission).toBeEnabled();
  await page.getByTestId("api-key-name-input").fill(names.name);
  for (const action of ["read", "write"]) {
    const permission = page.getByTestId(
      `permission-${scope}_API_KEY__${action.toUpperCase()}`,
    );
    await expect(permission).toBeVisible();
    await expect(permission).not.toBeChecked();
    await permission.click();
    await expect(permission).toBeChecked();
  }
  await page.getByTestId("api-key-create-submit").click();

  const revealedKey = page.getByTestId("api-key-created-value");
  await expect(revealedKey).toContainText(/^sk[A-Za-z0-9_-]{64}$/);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: "复制 API 密钥", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "已复制", exact: true }),
  ).toBeVisible();
  const secret = await revealedKey.textContent();
  expect(
    await page.evaluate(
      async (value) => (await navigator.clipboard.readText()) === value,
      secret,
    ),
  ).toBe(true);
  expect(page.url()).not.toContain(secret!);
  await page.getByTestId("api-key-back").click();
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await expect(revealedKey).toHaveCount(0);

  const row = page.getByRole("row").filter({ hasText: names.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("sk");

  await row.getByRole("button").click();
  await page.getByRole("menuitem", { name: "禁用" }).click();
  await expect(row).toContainText("已禁用");

  const detailPath = await row
    .getByRole("link", { name: names.name, exact: true })
    .getAttribute("href");
  // A non-link cell opens the same detail route as the name link.
  await row.getByRole("cell").nth(2).click();
  await expect(page).toHaveURL(new URL(detailPath!, listUrl).href);
  await page.reload();
  await expect(page.getByTestId("api-key-rename-input")).toHaveValue(
    names.name,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(revealedKey).toHaveCount(0);
  for (const action of ["read", "write"]) {
    await expect(
      page.getByTestId(`permission-${scope}_API_KEY__${action.toUpperCase()}`),
    ).toBeChecked();
  }
  await page.getByTestId("api-key-rename-input").fill(names.renamedName);
  await page.getByTestId(`permission-${scope}_API_KEY__WRITE`).click();
  await page.getByTestId("api-key-rename-input").press("Enter");
  await expect(
    page.getByText("API 密钥更新成功", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("api-key-rename-input")).toHaveValue(
    names.renamedName,
  );
  await expect(
    page.getByTestId(`permission-${scope}_API_KEY__WRITE`),
  ).not.toBeChecked();
  await page.getByTestId("api-key-back").click();

  const renamedRow = page
    .getByRole("row")
    .filter({ hasText: names.renamedName });
  await expect(renamedRow).toBeVisible();

  await renamedRow.getByRole("button").click();
  await page.getByRole("menuitem", { name: "删除" }).click();
  await page.getByTestId("alert-dialog-confirm").click();
  await expect(renamedRow).not.toBeVisible();
  // Deleted and invalid IDs do not render an editor or stale cached data.
  await page.goto(detailPath!);
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await page.goto(`${listUrl}/000000000000000001`);
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await page.goto(`${listUrl}/create`);
  await expect(revealedKey).toHaveCount(0);
  await expect(page.getByTestId("api-key-name-input")).toHaveValue("");
}
