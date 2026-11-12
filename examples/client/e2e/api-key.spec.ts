import { expect, test } from "@playwright/test";
import { clickPageAction } from "./utils/page-actions";
import { getPermissionCheckbox } from "./utils/permissions";

import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import {
  addWorkspaceMemberByApi,
  createFirstWorkspace,
  createWorkspaceByApi,
} from "./utils/workspace";
import type { Page } from "@playwright/test";

test.describe("API keys", () => {
  test("creates a You key without service account permissions", async ({
    page,
    browser,
  }) => {
    const seed = uniqueSeed("you-api-key");
    await registerUser(page, {
      email: `${seed}-owner@example.com`,
      name: "Workspace Owner",
    });
    const workspaceId = await createFirstWorkspace(page, seed);
    const context = await browser.newContext();
    try {
      const issuer = await context.newPage();
      const email = `${seed}-issuer@example.com`;
      await registerUser(issuer, { email, name: "Key Issuer" });
      const memberId = await addWorkspaceMemberByApi(page, workspaceId, email);
      const headers = { "x-workspace-id": workspaceId };
      await graphqlRequest(
        page.request,
        `mutation ($id: ID!, $input: SetWorkspaceMemberPermissionsInput!) {
        setWorkspaceMemberPermissions(id: $id, input: $input) { id }
      }`,
        {
          id: memberId,
          input: {
            permissions: [
              "WORKSPACE_API_KEY__READ",
              "WORKSPACE_API_KEY__WRITE",
            ],
          },
        },
        headers,
      );
      await issuer.goto(`/workspaces/${workspaceId}/api-keys/create`);
      await expect(
        issuer.getByRole("tab", { name: "You", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(
        issuer.getByRole("tab", { name: "Service account", exact: true }),
      ).toBeDisabled();
      await expect(
        issuer.getByRole("combobox", { name: "Service account", exact: true }),
      ).toHaveCount(0);
      await issuer.getByLabel("Name", { exact: true }).fill(`My key ${seed}`);
      await issuer.getByRole("button", { name: "Create", exact: true }).click();
      await expect(issuer.getByLabel("Key", { exact: true })).toHaveValue(
        /^ws_[A-Za-z0-9_-]{64}$/,
      );
      const id = new URL(issuer.url()).pathname.split("/").at(-1)!;
      const data = await graphqlRequest<{
        currentWorkspace: {
          apiKey: {
            id: string;
            permissions: Array<string>;
            member: { __typename: string; id: string } | null;
          };
          members: { totalCount: number };
        };
      }>(
        page.request,
        `query ($id: ID!, $memberFilter: WorkspaceMemberFilter) { currentWorkspace {
        apiKey(id: $id) { id permissions member { __typename  id  } }
        members(first: 10, filter: $memberFilter) { totalCount }
      } }`,
        { id, memberFilter: { type: { $eq: "SERVICE_ACCOUNT" } } },
        headers,
      );
      expect(data.currentWorkspace.apiKey).toEqual({
        id,
        permissions: [],
        member: { __typename: "WorkspaceMember", id: memberId },
      });
      expect(data.currentWorkspace.members.totalCount).toBe(0);
      const { workspaceMember: member } = await graphqlRequest<{
        workspaceMember: {
          apiKeys: { edges: Array<{ node: { id: string } }> };
        };
      }>(
        page.request,
        "query($id: ID!) { workspaceMember(id: $id) { apiKeys(first: 10) { edges { node { id } } } } }",
        { id: memberId },
        headers,
      );
      expect(member.apiKeys.edges.map(({ node }) => node.id)).toContain(id);
    } finally {
      await context.close();
    }
  });

  test("limits member-key selections and defaults to the issuer's grants", async ({
    page,
    browser,
  }) => {
    const seed = uniqueSeed("limited-member-key");
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
      const id = await addWorkspaceMemberByApi(page, workspaceId, email);
      await graphqlRequest(
        page.request,
        `mutation ($id: ID!, $input: SetWorkspaceMemberPermissionsInput!) {
        setWorkspaceMemberPermissions(id: $id, input: $input) { id }
      }`,
        {
          id,
          input: {
            permissions: [
              "WORKSPACE_API_KEY__READ",
              "WORKSPACE_API_KEY__WRITE",
              "WORKSPACE_SERVICE_ACCOUNT__READ",
              "WORKSPACE_SERVICE_ACCOUNT__WRITE",
              "WORKSPACE__UPDATE",
            ],
          },
        },
        { "x-workspace-id": workspaceId },
      );
      await issuerPage.goto(`/workspaces/${workspaceId}/api-keys`);
      await issuerPage
        .getByRole("button", { name: "Create", exact: true })
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
        "WORKSPACE_MEMBER__WRITE",
        "WORKSPACE_MEMBER__INVITE",
      ]) {
        await expect(
          getPermissionCheckbox(issuerPage, permission),
        ).toBeDisabled();
        await expect(
          getPermissionCheckbox(issuerPage, permission),
        ).not.toBeChecked();
      }
      await issuerPage
        .getByRole("tab", { name: "Service account", exact: true })
        .click();
      await issuerPage
        .getByLabel("Name", { exact: true })
        .fill(`Limited key ${seed}`);
      await issuerPage
        .getByRole("button", { name: "Create", exact: true })
        .click();
      await expect(issuerPage.getByLabel("Key", { exact: true })).toHaveValue(
        /^ws_[A-Za-z0-9_-]{64}$/,
      );
    } finally {
      await issuerContext.close();
    }
  });

  test("searches service accounts and creates a default account when cleared", async ({
    page,
  }) => {
    const seed = uniqueSeed("service-account-key");
    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Key Owner",
    });
    const workspaceId = await createFirstWorkspace(page, seed);
    const headers = { "x-workspace-id": workspaceId };
    const { addWorkspaceMember } = await graphqlRequest<{
      addWorkspaceMember: { id: string };
    }>(
      page.request,
      `mutation { addWorkspaceMember(input: { type: SERVICE_ACCOUNT, name: "Build automation" }) { id } }`,
      {},
      headers,
    );
    await graphqlRequest(
      page.request,
      `mutation { addWorkspaceMember(input: { type: SERVICE_ACCOUNT, name: "Deploy automation" }) { id } }`,
      {},
      headers,
    );
    const creationOperations: Array<string> = [];
    page.on("request", (request) => {
      if (
        request.method() !== "POST" ||
        !request.url().endsWith("/api/graphql")
      )
        return;
      const payload = request.postDataJSON() as { operationName?: string };
      const operation = payload?.operationName;
      if (
        operation &&
        [
          "addWorkspaceServiceAccountForApiKey",
          "createWorkspaceApiKeyFromApiKeysRoute",
        ].includes(operation)
      )
        creationOperations.push(operation);
    });
    const readKey = (id: string) =>
      graphqlRequest<{
        currentWorkspace: {
          apiKey: {
            id: string;
            permissions: Array<string>;
            member: { __typename: string; id: string } | null;
          };
        };
      }>(
        page.request,
        `query ($id: ID!) { currentWorkspace { apiKey(id: $id) { id permissions member { __typename  id  } } } }`,
        { id },
        headers,
      );
    await page.goto(`/workspaces/${workspaceId}/api-keys/create`);
    await page
      .getByRole("tab", { name: "Service account", exact: true })
      .click();
    const serviceAccount = page.getByRole("combobox", {
      name: "Service account",
      exact: true,
    });
    await serviceAccount.fill("Build");
    await expect(
      page.getByRole("option", { name: "Deploy automation" }),
    ).toHaveCount(0);
    await page
      .getByRole("option", { name: "Build automation", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill(`Existing ${seed}`);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByLabel("Key", { exact: true })).toHaveValue(
      /^ws_[A-Za-z0-9_-]{64}$/,
    );
    expect(creationOperations).toEqual([
      "createWorkspaceApiKeyFromApiKeysRoute",
    ]);
    const existingId = new URL(page.url()).pathname.split("/").at(-1)!;
    expect((await readKey(existingId)).currentWorkspace.apiKey).toEqual({
      id: existingId,
      permissions: [],
      member: { __typename: "WorkspaceMember", id: addWorkspaceMember.id },
    });

    await page.goto(`/workspaces/${workspaceId}/api-keys/create`);
    await page
      .getByRole("tab", { name: "Service account", exact: true })
      .click();
    await serviceAccount.fill("Build");
    await page
      .getByRole("option", { name: "Build automation", exact: true })
      .click();
    await page.locator('[data-slot="combobox-clear"]').click();
    await expect(serviceAccount).toHaveValue("");
    const name = `Automatic ${seed}`;
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByLabel("Key", { exact: true })).toHaveValue(
      /^ws_[A-Za-z0-9_-]{64}$/,
    );
    expect(creationOperations).toEqual([
      "createWorkspaceApiKeyFromApiKeysRoute",
      "addWorkspaceServiceAccountForApiKey",
      "createWorkspaceApiKeyFromApiKeysRoute",
    ]);
    const automaticId = new URL(page.url()).pathname.split("/").at(-1)!;
    const key = (await readKey(automaticId)).currentWorkspace.apiKey;
    expect(key.permissions).toEqual([]);
    const { currentWorkspace: createdOwner } = await graphqlRequest<{
      currentWorkspace: {
        members: {
          edges: Array<{
            node: {
              id: string;
              name: string;
              type: string;
              roles: Array<string>;
              permissions: Array<string>;
              apiKeys: { edges: Array<{ node: { id: string } }> };
            };
          }>;
        };
      };
    }>(
      page.request,
      "query($filter: WorkspaceMemberFilter) { currentWorkspace { members(first: 10, filter: $filter) { edges { node { id name type roles permissions apiKeys(first: 10) { edges { node { id } } } } } } } }",
      { filter: { name, type: "SERVICE_ACCOUNT" } },
      headers,
    );
    const {
      id: automaticOwnerId,
      apiKeys: ownerKeys,
      ...member
    } = createdOwner.members.edges[0].node;
    expect(automaticOwnerId).not.toBe(addWorkspaceMember.id);
    expect(ownerKeys.edges.map(({ node }) => node.id)).toContain(automaticId);
    expect(member).toEqual({
      name,
      type: "SERVICE_ACCOUNT",
      roles: ["MEMBER"],
      permissions: [],
    });
    await page.goto(`/workspaces/${workspaceId}/api-keys/create`);
    await page
      .getByRole("tab", { name: "Service account", exact: true })
      .click();
    await serviceAccount.fill("Build");
    await page
      .getByRole("option", { name: "Build automation", exact: true })
      .click();
    await page.getByRole("tab", { name: "You", exact: true }).click();
    await expect(serviceAccount).toHaveCount(0);
    await page.getByLabel("Name", { exact: true }).fill(`You ${seed}`);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByLabel("Key", { exact: true })).toHaveValue(
      /^ws_[A-Za-z0-9_-]{64}$/,
    );
    const youId = new URL(page.url()).pathname.split("/").at(-1)!;
    const { currentWorkspaceMember } = await graphqlRequest<{
      currentWorkspaceMember: { id: string };
    }>(page.request, "query { currentWorkspaceMember { id } }", {}, headers);
    const { workspaceMember: yourWorkspaceMembership } = await graphqlRequest<{
      workspaceMember: { apiKeys: { edges: Array<{ node: { id: string } }> } };
    }>(
      page.request,
      "query($id: ID!) { workspaceMember(id: $id) { apiKeys(first: 10) { edges { node { id } } } } }",
      { id: currentWorkspaceMember.id },
      headers,
    );
    expect(
      yourWorkspaceMembership.apiKeys.edges.map(({ node }) => node.id),
    ).toContain(youId);
    expect(creationOperations).toEqual([
      "createWorkspaceApiKeyFromApiKeysRoute",
      "addWorkspaceServiceAccountForApiKey",
      "createWorkspaceApiKeyFromApiKeysRoute",
      "createWorkspaceApiKeyFromApiKeysRoute",
    ]);
  });

  test("manages a member-owned API key", async ({ page }) => {
    const seed = uniqueSeed("member-api-key");

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
    await page
      .getByRole("menuitem", { name: /^Open personal overview:/ })
      .click();
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
    const { createWorkspaceApiKey: memberKey } = await graphqlRequest<{
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
      `/workspaces/${workspaceId}/api-keys/${memberKey.entity.id}`,
    );
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Workspace scoped key",
    );
    await page.goto(
      `/workspaces/${otherWorkspace.id}/api-keys/${memberKey.entity.id}`,
    );
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${otherWorkspace.id}/api-keys(?:\\?.*)?$`),
    );
    await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
    await page.goto(`/user/api-keys/${memberKey.entity.id}`);
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

  await page.getByRole("button", { name: "Create", exact: true }).click();
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

  await expect(page).toHaveURL(
    (url) =>
      url.pathname.startsWith(`${listUrl.pathname}/`) &&
      !url.pathname.endsWith("/create"),
  );
  await expect(
    page.getByRole("heading", { name: "API Key Details", exact: true }),
  ).toBeVisible();
  const revealedKey = page.getByLabel("Key", { exact: true });
  await expect(revealedKey).toHaveValue(
    scope === "USER" ? /^user_[A-Za-z0-9_-]{64}$/ : /^ws_[A-Za-z0-9_-]{64}$/,
  );
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy API Key", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  const secret = await revealedKey.inputValue();
  expect(
    await page.evaluate(
      async (value) => (await navigator.clipboard.readText()) === value,
      secret,
    ),
  ).toBe(true);
  expect(page.url()).not.toContain(secret);
  expect(
    await page.evaluate(
      (value) =>
        JSON.stringify([sessionStorage, localStorage, history.state]).includes(
          value,
        ),
      secret,
    ),
  ).toBe(false);
  if (scope === "WORKSPACE") {
    await page.reload();
    await expect(revealedKey).toBeDisabled();
    await expect(revealedKey).toHaveValue(`${secret.slice(0, 8)}...`);
    await expect(
      page.getByRole("button", { name: "Copy API Key", exact: true }),
    ).toHaveCount(0);
  }
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "API Keys", exact: true })
    .click();
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
  await expect(revealedKey).toHaveCount(0);
  if (scope === "USER") {
    await page.goBack();
    await expect(revealedKey).toBeDisabled();
    await expect(revealedKey).toHaveValue(`${secret.slice(0, 8)}...`);
    await expect(
      page.getByRole("button", { name: "Copy API Key", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Breadcrumbs" })
      .getByRole("link", { name: "API Keys", exact: true })
      .click();
  }

  const row = page.getByRole("row").filter({ hasText: names.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(scope === "USER" ? "user_" : "ws_");

  await expect(row.getByRole("button")).toHaveCount(0);

  const detailPath = await row
    .getByRole("link", { name: names.name, exact: true })
    .getAttribute("href");
  // A non-link cell opens the same detail route as the name link.
  await row.getByRole("cell").nth(2).click();
  await expect(page).toHaveURL(new URL(detailPath!, listUrl).href);
  await clickPageAction(page, "Disable");
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
  await clickPageAction(page, "Enable");
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    names.name,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(revealedKey).toBeDisabled();
  await expect(revealedKey).toHaveValue(`${secret.slice(0, 8)}...`);
  for (const action of ["read", "write"]) {
    await expect(
      getPermissionCheckbox(page, `${scope}_API_KEY__${action.toUpperCase()}`),
    ).toBeChecked();
  }
  await page.getByLabel("Name", { exact: true }).fill(names.renamedName);
  const metadataUpdate = page.waitForRequest((request) => {
    if (request.method() !== "POST" || !request.url().endsWith("/api/graphql"))
      return false;
    const payload = request.postDataJSON() as { operationName?: string };
    return (
      payload.operationName?.startsWith("update") === true &&
      payload.operationName.includes("ApiKey")
    );
  });
  await page.getByLabel("Name", { exact: true }).press("Enter");
  const payload = (await metadataUpdate).postDataJSON() as {
    variables: { input: unknown };
  };
  expect(payload.variables.input).toEqual({ name: names.renamedName });
  await expect(
    page.getByText("API key updated", { exact: true }),
  ).toBeVisible();
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

  await renamedRow
    .getByRole("link", { name: names.renamedName, exact: true })
    .click();
  await clickPageAction(page, "Delete");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page).toHaveURL(new URL(detailPath!, listUrl).href);
  await clickPageAction(page, "Delete");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page).toHaveURL((url) => url.pathname === listUrl.pathname);
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
