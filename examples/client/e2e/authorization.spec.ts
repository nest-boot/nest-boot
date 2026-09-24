import { expect, test } from "@playwright/test";

import { registerUser, signInAsE2eAdministrator } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { addMemberByApi, createWorkspaceByApi } from "./utils/workspace";

test("limits user detail queries and actions to the administrator's abilities", async ({
  browser,
  page,
}) => {
  const seed = uniqueSeed("limited-admin");
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Limited administrator",
    });
    const { currentUser } = await graphqlRequest<{
      currentUser: { id: string };
    }>(page.request, "query { currentUser { id } }");
    await signInAsE2eAdministrator(adminPage);
    const { createUser: target } = await graphqlRequest<{
      createUser: { id: string };
    }>(
      adminPage.request,
      "mutation ($input: CreateUserInput!) { createUser(input: $input) { id } }",
      {
        input: {
          email: `${seed}-target@example.com`,
          name: "Read-only target",
          password: "correct-horse-battery-staple",
        },
      },
    );
    const setPermissions = async (permissions: Array<string>) => {
      await graphqlRequest(
        adminPage.request,
        "mutation ($id: ID!, $input: SetUserPermissionsInput!) { setUserPermissions(id: $id, input: $input) { id } }",
        { id: currentUser.id, input: { permissions } },
      );
    };
    await setPermissions(["USER__READ"]);
    await page.goto("/admin/users/create");
    await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
    await expect(page.getByTestId("admin-create-user-page")).toHaveCount(0);
    await page.goto(`/admin/users/${target.id}`);
    await expect(page.getByTestId("admin-user-page")).toBeVisible();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Read-only target",
    );
    await expect(page.getByTestId("admin-user-name")).toBeDisabled();
    await expect(page.getByTestId("admin-user-email")).toBeDisabled();
    await expect(page.getByTestId("admin-impersonate-user")).toHaveCount(0);
    // With no catalog/session abilities, unrelated field queries must not fail the page.
    const buttons = page
      .getByTestId("admin-user-page")
      .locator('[data-slot="card"]')
      .getByRole("button");
    for (const button of await buttons.all())
      await expect(button).toBeDisabled();

    await setPermissions(["USER__READ", "USER__UPDATE"]);
    await page.reload();
    await expect(page.getByTestId("admin-user-name")).toBeEnabled();
    await expect(page.getByTestId("admin-user-email")).toBeDisabled();
    await page.getByTestId("admin-user-name").fill("Updated through ability");
    const updateResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/graphql") &&
        response
          .request()
          .postData()
          ?.includes("updateManagedUserFromUserRoute") === true,
    );
    await page.getByTestId("admin-user-profile-save").click();
    const updateBody = await (await updateResponse).json();
    expect(updateBody.errors, JSON.stringify(updateBody)).toBeUndefined();
    await expect(
      page.getByRole("heading", {
        name: "Updated through ability",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Updated through ability",
    );

    await setPermissions([
      "USER__READ",
      "USER__SET_ROLES",
      "USER__SET_PERMISSIONS",
    ]);
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Admin", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "User", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("checkbox", { name: "Delete Users", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "Read Users", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("checkbox", { name: "Read Users", exact: true })
      .check();
    await page.getByTestId("admin-user-permissions-save").click();
    await expect(page.getByTestId("admin-user-permissions-save")).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Read Users", exact: true }),
    ).toBeChecked();

    // Existing grants stay removable but cannot be granted again by this caller.
    await graphqlRequest(
      adminPage.request,
      "mutation ($id: ID!, $input: SetUserPermissionsInput!) { setUserPermissions(id: $id, input: $input) { id } }",
      { id: target.id, input: { permissions: ["USER__DELETE"] } },
    );
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Delete Users", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByTestId("admin-user-permissions-save"),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", { name: "Delete Users", exact: true })
      .uncheck();
    await expect(
      page.getByRole("checkbox", { name: "Delete Users", exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId("admin-user-permissions-save")).toBeEnabled();

    await setPermissions([]);
    await page.goto(`/admin/users/${target.id}`);
    await expect(page).toHaveURL(/\/user(?:\?.*)?$/);
  } finally {
    await adminContext.close();
  }
});

test("authorizes workspace API-key controls and deletion without an owner role", async ({
  browser,
  page,
}) => {
  const seed = uniqueSeed("workspace-abilities");
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  try {
    const memberEmail = `${seed}-member@example.com`;
    await registerUser(page, {
      email: memberEmail,
      name: "Custom permissions",
    });
    await registerUser(ownerPage, {
      email: `${seed}-owner@example.com`,
      name: "Workspace owner",
    });
    const workspace = await createWorkspaceByApi(ownerPage, seed);
    const memberId = await addMemberByApi(ownerPage, workspace.id, memberEmail);
    const headers = { "x-workspace-id": workspace.id };
    await graphqlRequest(
      ownerPage.request,
      "mutation ($input: CreateWorkspaceApiKeyInput!) { createWorkspaceApiKey(input: $input) { entity { id } } }",
      { input: { name: "Read-only workspace key", permissions: [] } },
      headers,
    );
    await page.goto(`/workspaces/${workspace.id}/api-keys`);
    await expect(page).not.toHaveURL(/\/api-keys(?:\?.*)?$/);
    await expect(
      page.getByTestId("workspace-sidebar-api-keys-link"),
    ).toHaveCount(0);
    await page.goto(`/workspaces/${workspace.id}/settings`);
    await expect(page.getByTestId("workspace-settings-delete")).toHaveCount(0);
    const denied = await page.request.post("/api/graphql", {
      headers,
      data: {
        query: "mutation ($id: ID!) { deleteWorkspace(id: $id) { id } }",
        variables: { id: workspace.id },
      },
    });
    expect((await denied.json()).errors).toBeDefined();

    await graphqlRequest(
      ownerPage.request,
      "mutation ($id: ID!, $input: SetMemberPermissionsInput!) { setMemberPermissions(id: $id, input: $input) { id } }",
      {
        id: memberId,
        input: {
          permissions: ["WORKSPACE_API_KEY__READ", "WORKSPACE__DELETE"],
        },
      },
      headers,
    );
    await page.goto(`/workspaces/${workspace.id}/api-keys`);
    await expect(page.getByTestId("api-keys-page")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create API Key", exact: true }),
    ).toBeDisabled();
    const row = page
      .getByRole("row")
      .filter({ hasText: "Read-only workspace key" });
    await row.getByRole("button").click();
    for (const name of ["Edit", "Disable", "Delete"])
      await expect(
        page.getByRole("menuitem", { name, exact: true }),
      ).toBeDisabled();
    await page.keyboard.press("Escape");
    await row.getByRole("link", { name: "Read-only workspace key" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspace.id}/api-keys/\\d+$`),
    );
    await expect(page.getByTestId("api-key-rename-input")).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "Update Workspace", exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId("api-key-rename-submit")).toHaveCount(0);
    await page.goto(`/workspaces/${workspace.id}/api-keys/create`);
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspace.id}/api-keys(?:\\?.*)?$`),
    );
    await page.goto(`/workspaces/${workspace.id}/settings`);
    await expect(page.getByTestId("workspace-settings-delete")).toBeEnabled();
    await page.getByTestId("workspace-settings-delete").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    const { currentUser } = await graphqlRequest<{
      currentUser: { workspaces: { edges: Array<unknown> } };
    }>(
      ownerPage.request,
      "query { currentUser { workspaces(first: 10) { edges { node { id } } } } }",
    );
    expect(currentUser.workspaces.edges).toEqual([]);
  } finally {
    await ownerContext.close();
  }
});

test("uses personal API-key abilities for navigation and instance actions", async ({
  page,
}) => {
  const seed = uniqueSeed("personal-key-abilities");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Key owner",
  });
  const { createUserApiKey: key } = await graphqlRequest<{
    createUserApiKey: { entity: { id: string } };
  }>(
    page.request,
    "mutation ($input: CreateUserApiKeyInput!) { createUserApiKey(input: $input) { entity { id } } }",
    { input: { name: "Conditionally writable key", permissions: [] } },
  );
  // Exercise custom serialized rules; Service authorization is tested separately.
  let allowRead = true;
  let allowedId = "another-key";
  await page.route("**/api/graphql", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.data?.currentAbilityRules) {
      body.data.currentAbilityRules = [
        ...(allowRead
          ? [{ actions: ["read"], subjects: ["UserApiKey"], inverted: false }]
          : []),
        {
          actions: ["write"],
          subjects: ["UserApiKey"],
          conditions: { id: allowedId },
          inverted: false,
        },
      ];
    }
    await route.fulfill({ response, json: body });
  });
  try {
    await page.goto("/user/api-keys");
    await expect(page.getByTestId("api-keys-page")).toBeVisible();
    // A class-level write check opens the form; the Service checks the proposed key.
    await expect(
      page.getByRole("button", { name: "Create API Key", exact: true }),
    ).toBeEnabled();
    const row = page
      .getByRole("row")
      .filter({ hasText: "Conditionally writable key" });
    await row.getByRole("button").click();
    for (const name of ["Edit", "Disable", "Delete"])
      await expect(
        page.getByRole("menuitem", { name, exact: true }),
      ).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.goto(`/user/api-keys/${key.entity.id}`);
    await expect(page.getByTestId("api-key-rename-input")).toBeDisabled();
    await expect(page.getByTestId("api-key-rename-submit")).toHaveCount(0);
    await page.getByTestId("api-key-back").click();
    allowedId = key.entity.id;
    await page.reload();
    await row.getByRole("button").click();
    for (const name of ["Edit", "Disable", "Delete"])
      await expect(
        page.getByRole("menuitem", { name, exact: true }),
      ).toBeEnabled();
    await page.keyboard.press("Escape");
    await page.goto(`/user/api-keys/${key.entity.id}`);
    await expect(page.getByTestId("api-key-rename-input")).toBeEnabled();
    await expect(page.getByTestId("api-key-rename-submit")).toBeEnabled();
    allowRead = false;
    await page.goto(`/user/api-keys/${key.entity.id}`);
    await expect(page).toHaveURL(/\/user$/);
    await page.goto("/user/api-keys/create");
    await expect(page).toHaveURL(/\/user$/);
    await expect(page.getByTestId("user-sidebar-api-keys-link")).toHaveCount(0);
  } finally {
    // Finish in-flight response handlers before Playwright disposes the context.
    await page.unrouteAll({ behavior: "wait" });
  }
});
