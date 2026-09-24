import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import {
  addMemberByApi,
  createFirstWorkspace,
  createWorkspaceByApi,
} from "./utils/workspace";
import { uniqueSeed } from "./utils/unique";
import type { Page } from "@playwright/test";

test.describe("workspace management", () => {
  test("leaves the workspace page after disabling the current member without refetching protected fields", async ({
    page,
  }) => {
    const seed = uniqueSeed("self-disabled-member");
    const email = `${seed}@example.com`;
    await registerUser(page, { email, name: "Self-disabling owner" });
    const workspace = await createWorkspaceByApi(page, seed);
    await page.goto(`/workspaces/${workspace.id}/members`);
    const row = page.getByRole("row").filter({
      has: page.getByTestId(`member-row-${email}`),
    });
    await row.getByRole("button").click();
    const pageErrors: Array<string> = [];
    const refetches: Array<string> = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      const body = request.postData() ?? "";
      if (body.includes("getMembersFromMembersRoute")) refetches.push(body);
    });
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/graphql") &&
        response
          .request()
          .postData()
          ?.includes("updateMemberStatusFromMembersRoute") === true,
    );
    await page.getByRole("menuitem", { name: "Disable", exact: true }).click();
    expect((await (await updated).json()).errors).toBeUndefined();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
    const workspaces = await listWorkspaces(page, { first: 10 });
    expect(workspaces.edges).toEqual([]);
    expect(refetches).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("supports multiple owners through member roles and lets an owner leave", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("workspace-ownership");
    const ownerEmail = `${seed}-owner@example.com`;
    const memberEmail = `${seed}-member@example.com`;
    const workspaceName = `所有权工作空间 ${seed}`;
    const memberName = `New Owner ${seed}`;
    const memberContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const memberPage = await memberContext.newPage();

    try {
      await registerUser(memberPage, {
        email: memberEmail,
        name: memberName,
      });
      await registerUser(page, {
        email: ownerEmail,
        name: `Previous Owner ${seed}`,
      });
      const workspaceId = await createFirstWorkspace(page, workspaceName);
      const memberId = await addMemberByApi(page, workspaceId, memberEmail);
      await page.goto(`/workspaces/${workspaceId}/members/${memberId}`);
      await page.getByRole("checkbox", { name: "Owner", exact: true }).click();
      await page.getByRole("checkbox", { name: "Member", exact: true }).click();
      await page.getByTestId("member-roles-save").click();
      await expect(page.getByText("Member updated successfully")).toBeVisible();

      const { currentWorkspace } = await graphqlRequest<{
        currentWorkspace: {
          members: { edges: Array<{ node: { roles: Array<string> } }> };
        };
      }>(
        page.request,
        "query { currentWorkspace { members(first: 10) { edges { node { roles } } } } }",
        {},
        { "x-workspace-id": workspaceId },
      );
      expect(
        currentWorkspace.members.edges.filter(({ node }) =>
          node.roles.includes("OWNER"),
        ),
      ).toHaveLength(2);

      await memberPage.goto(`/workspaces/${workspaceId}/settings`);
      await expect(
        memberPage.getByTestId("workspace-transfer-ownership"),
      ).toHaveCount(0);
      await expect(memberPage.getByTestId("workspace-leave")).toBeVisible();

      await page.goto(`/workspaces/${workspaceId}/settings`);
      await expect(
        page.getByTestId("workspace-transfer-ownership"),
      ).toHaveCount(0);
      await expect(page.getByTestId("workspace-leave")).toBeVisible();

      await page.getByTestId("workspace-leave").click();
      const leaveResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/graphql") &&
          response
            .request()
            .postData()
            ?.includes("leaveWorkspaceFromSettingsRoute") === true,
      );
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Leave workspace", exact: true })
        .click();
      const leaveResult = await (await leaveResponse).json();
      expect(leaveResult.errors).toBeUndefined();
      expect(leaveResult.data.leaveWorkspace).toEqual({
        __typename: "LeaveWorkspacePayload",
        memberId: expect.any(String),
      });
      await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
      await expect(page.getByText("You left the workspace")).toBeVisible();
      await expect(
        memberPage.getByTestId("workspace-settings-name-input"),
      ).toHaveValue(workspaceName);
    } finally {
      await memberContext.close();
    }
  });

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

    await page.getByRole("link", { name: "Settings", exact: true }).click();
    const nameInput = page.getByTestId("workspace-settings-name-input");
    await expect(nameInput).toHaveValue(workspaceName);

    await nameInput.fill(renamedWorkspaceName);
    await page.getByTestId("workspace-settings-save").click();
    await expect(nameInput).toHaveValue(renamedWorkspaceName);

    // The normalized Workspace cache must refresh without a page reload.
    await expect(page.getByTestId("topbar-menu-trigger")).toContainText(
      renamedWorkspaceName,
    );

    await page.reload();
    await expect(nameInput).toHaveValue(renamedWorkspaceName);

    await page.getByTestId("workspace-settings-delete").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
  });

  test("loads and switches workspaces and opens workspace management", async ({
    page,
  }) => {
    const seed = uniqueSeed("workspace-switcher");
    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Workspace Switcher Owner",
    });
    const firstWorkspaceId = await createFirstWorkspace(
      page,
      `Switcher Workspace 0 ${seed}`,
    );
    const workspaces: Array<{ id: string; name: string }> = [];
    for (let index = 1; index <= 10; index += 1) {
      workspaces.push(
        await createWorkspaceByApi(
          page,
          `Switcher Workspace ${String(index)} ${seed}`,
        ),
      );
    }

    const firstPage = await listWorkspaces(page, { first: 10 });
    expect(firstPage.edges).toHaveLength(10);
    expect(firstPage.pageInfo.hasNextPage).toBe(true);
    const secondPage = await listWorkspaces(page, {
      after: firstPage.pageInfo.endCursor!,
      first: 10,
    });
    expect(secondPage.edges).toHaveLength(1);

    await page.goto(`/workspaces/${firstWorkspaceId}/settings`);
    await page.getByTestId("topbar-menu-trigger").click();
    await expect(
      page.locator('[data-testid^="workspace-switcher-workspace-"]'),
    ).toHaveCount(10);
    await page.getByTestId("workspace-switcher-load-more").click();
    await expect(
      page.locator('[data-testid^="workspace-switcher-workspace-"]'),
    ).toHaveCount(11);

    const target = workspaces.at(-1)!;
    await page.getByTestId(`workspace-switcher-workspace-${target.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${target.id}$`));

    await page.getByTestId("topbar-menu-trigger").click();
    await expect(
      page.getByText("Recent workspaces", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("workspace-switcher-create")).toHaveCount(0);
    await page.getByTestId("workspace-switcher-manage").click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await page.getByTestId("user-workspace-create-action").click();
    await expect(page).toHaveURL(/\/workspaces\/create$/);
    await expect(page.getByTestId("workspace-create-submit")).toBeVisible();
  });
});

async function listWorkspaces(
  page: Page,
  variables: { after?: string; first: number },
) {
  const data = await graphqlRequest<{
    currentUser: {
      workspaces: {
        edges: Array<{ node: { id: string; name: string } }>;
        pageInfo: { endCursor?: string | null; hasNextPage: boolean };
      };
    };
  }>(
    page.request,
    /* GraphQL */ `
      query ListWorkspaces($after: String, $first: Int) {
        currentUser {
          workspaces(after: $after, first: $first) {
            edges {
              node {
                id
                name
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    `,
    variables,
  );

  return data.currentUser.workspaces;
}
