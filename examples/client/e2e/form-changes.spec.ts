import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  registerUser,
  signInAsE2eAdministrator,
  testPassword,
} from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";
import type { Page } from "@playwright/test";

async function submitInput(
  page: Page,
  operation: string,
  submit: () => Promise<unknown>,
) {
  const response = page.waitForResponse(
    (response) => response.request().postData()?.includes(operation) === true,
  );
  await submit();
  const saved = await response;
  expect((await saved.json()).errors).toBeUndefined();
  return saved.request().postDataJSON().variables.input;
}

for (const kind of ["profile", "workspace"] as const) {
  test(`${kind} preserves edits made while a name save is pending`, async ({
    page,
  }) => {
    await registerUser(page, {
      email: `${uniqueSeed(`pending-${kind}`)}@example.com`,
      name: "Original name",
    });
    const workspace =
      kind === "workspace"
        ? await createWorkspaceByApi(page, "Original workspace")
        : undefined;
    await page.goto(
      workspace ? `/workspaces/${workspace.id}/settings` : "/user/profile",
    );
    const operation = workspace
      ? "updateWorkspaceFromSettingsRoute"
      : "updateUserFromUserRoute";
    const formId = workspace ? "workspace-settings-form" : "user-profile-form";
    const draftField = page.getByLabel(workspace ? "Workspace slug" : "Name", {
      exact: true,
    });
    const draft = `pending-${randomUUID().slice(0, 12)}`;
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const intercepted = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route("**/api/graphql", async (route) => {
      if (!route.request().postData()?.includes(operation))
        return route.continue();
      const response = await route.fetch();
      started();
      await pending;
      await route.fulfill({ response });
    });
    try {
      await page.getByLabel("Name", { exact: true }).fill("Saved name");
      const button = page.locator(`button[form='${formId}']`);
      await button.click();
      await intercepted;
      await draftField.fill(draft);
      release();
      await expect(
        page.getByText(workspace ? "Workspace updated" : "Profile updated", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(draftField).toHaveValue(draft);
      await expect(button).toBeEnabled();
      await page.unroute("**/api/graphql");
      expect(await submitInput(page, operation, () => button.click())).toEqual(
        workspace ? { slug: draft } : { name: draft },
      );
      await expect(button).toBeDisabled();
      await page.reload();
      await expect(draftField).toHaveValue(draft);
    } finally {
      release();
    }
  });
}

test("changing a workspace slug preserves its externally updated name", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("workspace-diff")}@example.com`,
    name: "Workspace owner",
  });
  const workspace = await createWorkspaceByApi(page, "Original workspace");
  await page.goto(`/workspaces/${workspace.id}/settings`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Original workspace",
  );
  const headers = { "x-workspace": workspace.id };
  await graphqlRequest(
    page.request,
    "mutation($id: ID!, $input: UpdateWorkspaceInput!) { updateWorkspace(id: $id, input: $input) { id } }",
    { id: workspace.id, input: { name: "Externally renamed workspace" } },
    headers,
  );
  const slug = `changed-${randomUUID().slice(0, 12)}`;
  await page.getByLabel("Workspace slug", { exact: true }).fill(slug);
  expect(
    await submitInput(page, "updateWorkspaceFromSettingsRoute", () =>
      page.locator("button[form='workspace-settings-form']").click(),
    ),
  ).toEqual({ slug });
  const data = await graphqlRequest<{
    workspace: { name: string; slug: string };
  }>(
    page.request,
    "query($id: ID!) { workspace(id: $id) { name slug } }",
    { id: workspace.id },
    headers,
  );
  expect(data.workspace).toEqual({
    name: "Externally renamed workspace",
    slug,
  });
});

test("administrator name edits preserve concurrent email and verification changes", async ({
  page,
}) => {
  await signInAsE2eAdministrator(page);
  const seed = uniqueSeed("admin-profile-diff");
  const created = await graphqlRequest<{ createUser: { id: string } }>(
    page.request,
    "mutation($input: CreateUserInput!) { createUser(input: $input) { id } }",
    {
      input: {
        name: "Original user",
        email: `${seed}@example.com`,
        password: testPassword,
      },
    },
  );
  const id = created.createUser.id;
  await page.goto(`/admin/users/${id}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Original user",
  );
  const email = `${seed}-changed@example.com`;
  await graphqlRequest(
    page.request,
    "mutation($id: ID!, $input: UpdateUserInput!) { updateUser(id: $id, input: $input) { id } }",
    { id, input: { email, emailVerified: true } },
  );
  await page.getByLabel("Name", { exact: true }).fill("Edited user");
  expect(
    await submitInput(page, "updateManagedUserFromUserRoute", () =>
      page
        .locator("[data-slot='card']")
        .filter({ has: page.getByLabel("Name", { exact: true }) })
        .getByRole("button", { name: "Save", exact: true })
        .click(),
    ),
  ).toEqual({ name: "Edited user" });
  const data = await graphqlRequest<{
    user: { name: string; email: string; emailVerified: boolean };
  }>(
    page.request,
    "query($id: ID!) { user(id: $id) { name email emailVerified } }",
    { id },
  );
  expect(data.user).toEqual({
    name: "Edited user",
    email,
    emailVerified: true,
  });
});

test("member name edits preserve a concurrent contact email change", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("member-diff")}@example.com`,
    name: "Original member",
  });
  const workspace = await createWorkspaceByApi(page, "Member workspace");
  const headers = { "x-workspace": workspace.id };
  const { currentWorkspaceMember } = await graphqlRequest<{
    currentWorkspaceMember: { id: string };
  }>(page.request, "query { currentWorkspaceMember { id } }", {}, headers);
  const id = currentWorkspaceMember.id;
  await page.goto(`/workspaces/${workspace.id}/members/${id}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Original member",
  );
  const email = `${uniqueSeed("contact")}@example.com`;
  await graphqlRequest(
    page.request,
    "mutation($id: ID!, $input: UpdateWorkspaceMemberInput!) { updateWorkspaceMember(id: $id, input: $input) { id } }",
    { id, input: { email } },
    headers,
  );
  await page.getByLabel("Name", { exact: true }).fill("Edited member");
  expect(
    await submitInput(
      page,
      "updateWorkspaceMemberFromWorkspaceMemberRoute",
      () =>
        page
          .locator("[data-slot='card']")
          .filter({ has: page.getByLabel("Name", { exact: true }) })
          .getByRole("button", { name: "Save", exact: true })
          .click(),
    ),
  ).toEqual({ name: "Edited member" });
  const data = await graphqlRequest<{
    workspaceMember: { name: string; email: string };
  }>(
    page.request,
    "query($id: ID!) { workspaceMember(id: $id) { name email } }",
    { id },
    headers,
  );
  expect(data.workspaceMember).toEqual({ name: "Edited member", email });
});

test("TanStack validation blocks invalid identifiers and whitespace-only workspace names", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("form-validation")}@example.com`,
    name: "Validation user",
  });
  let writes = 0;
  page.on("request", (request) => {
    if (
      /updateUserFromUserRoute|createWorkspaceFromCreateWorkspaceRoute|updateWorkspaceFromSettingsRoute/.test(
        request.postData() ?? "",
      )
    )
      writes++;
  });
  await page.goto("/user/profile");
  await page.getByLabel("Name", { exact: true }).fill("   ");
  await page.locator("button[form='user-profile-form']").click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(writes).toBe(0);
  await page.goto("/user/workspaces/create");
  await page.getByLabel("Name", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByText("Workspace name is required", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
});
