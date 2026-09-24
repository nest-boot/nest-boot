import { expect, test } from "@playwright/test";

import {
  completeEmailVerification,
  registerUser,
  testPassword,
} from "./utils/auth";
import { waitForEmailUrl } from "./utils/mailpit";
import { addMemberByApi, createFirstWorkspace } from "./utils/workspace";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";

test.describe("workspace invitations", () => {
  test("shows an expired invitation and clears the pending redirect", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("expired-invite");
    const ownerEmail = `${seed}-owner@example.com`;
    const inviteeEmail = `${seed}-invitee@example.com`;
    const workspaceName = `过期邀请工作空间 ${seed}`;
    const inviteeContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const inviteePage = await inviteeContext.newPage();

    try {
      await registerUser(inviteePage, {
        email: inviteeEmail,
        name: "Expired Invitee",
      });
      await registerUser(page, {
        email: ownerEmail,
        name: "Expired Invite Owner",
      });
      const workspaceId = await createFirstWorkspace(page, workspaceName);
      const { createInvitation } = await graphqlRequest<{
        createInvitation: { id: string };
      }>(
        page.request,
        /* GraphQL */ `
          mutation CreateExpiringInvitation($input: CreateInvitationInput!) {
            createInvitation(input: $input) {
              id
            }
          }
        `,
        {
          input: {
            email: inviteeEmail,
            expiresIn: 1,
            roles: ["MEMBER"],
          },
        },
        { "x-workspace-id": workspaceId },
      );

      const { invitation } = await graphqlRequest<{
        invitation: { expiresAt: string };
      }>(
        page.request,
        "query ($id: ID!) { invitation(id: $id) { expiresAt } }",
        { id: createInvitation.id },
        { "x-workspace-id": workspaceId },
      );
      await inviteePage.evaluate((invitationId) => {
        localStorage.setItem("invitation_id", invitationId);
      }, createInvitation.id);
      await expect
        .poll(() => Date.now())
        .toBeGreaterThan(new Date(invitation.expiresAt).getTime());

      await inviteePage.goto(`/invite?invitationId=${createInvitation.id}`);
      await expect(inviteePage.getByTestId("invite-error-page")).toBeVisible();
      await expect(
        inviteePage.getByText(
          "This invitation has expired. Ask a workspace administrator to send a new one.",
        ),
      ).toBeVisible();
      expect(
        await inviteePage.evaluate(() => localStorage.getItem("invitation_id")),
      ).toBeNull();

      await inviteePage.getByTestId("invite-error-exit").click();
      await expect(inviteePage).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    } finally {
      await inviteeContext.close();
    }
  });

  test("cancels a pending invitation without creating a member row", async ({
    browser,
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const seed = uniqueSeed("delete-invite");
    const ownerEmail = `${seed}-owner@example.com`;
    const inviteeEmail = `${seed}-invitee@example.com`;
    const workspaceName = `删除邀请工作空间 ${seed}`;
    const inviteeContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const inviteePage = await inviteeContext.newPage();

    try {
      await registerUser(inviteePage, {
        email: inviteeEmail,
        name: "Canceled Invitee",
      });
      await registerUser(page, {
        email: ownerEmail,
        name: "Invite Owner",
      });
      const workspaceId = await createFirstWorkspace(page, workspaceName);

      await page.goto(`/workspaces/${workspaceId}/members`);
      await expect(
        page.getByRole("heading", { name: "Members", exact: true }),
      ).toBeVisible();

      await page.getByRole("link", { name: "Invite", exact: true }).click();
      await page.getByTestId("workspace-invite-email-input").fill(inviteeEmail);
      await page.getByRole("checkbox", { name: "Member", exact: true }).click();
      await page.getByTestId("workspace-invite-confirm").click();
      const inviteLink = (
        await page.getByTestId("workspace-invite-link").textContent()
      )?.trim();
      expect(inviteLink).toContain("/invite?invitationId=");
      await page
        .getByRole("navigation", { name: "Breadcrumbs" })
        .getByRole("link", { name: "Members", exact: true })
        .click();

      const invitation = page.getByTestId(`invitation-${inviteeEmail}`);
      await expect(invitation).toBeVisible();
      await expect(page.getByTestId(`member-row-${inviteeEmail}`)).toHaveCount(
        0,
      );

      await invitation.getByRole("button", { name: "Cancel" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();

      await expect(invitation).toHaveCount(0);

      await inviteePage.evaluate((invitationId) => {
        localStorage.setItem("invitation_id", invitationId);
      }, new URL(inviteLink!).searchParams.get("invitationId")!);
      await inviteePage.goto(inviteLink!);
      await expect(inviteePage.getByTestId("invite-error-page")).toBeVisible();
      await expect(
        inviteePage.getByText("This invitation has been canceled."),
      ).toBeVisible();
      expect(
        await inviteePage.evaluate(() => localStorage.getItem("invitation_id")),
      ).toBeNull();

      await inviteePage.goto(
        "/invite?invitationId=00000000-0000-4000-8000-000000000000",
      );
      await expect(inviteePage.getByTestId("invite-error-page")).toBeVisible();
    } finally {
      await inviteeContext.close();
    }
  });

  test("invites a member and accepts the invite through registration", async ({
    browser,
    context,
    page,
    request,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const seed = uniqueSeed("invite");
    const ownerEmail = `${seed}-owner@example.com`;
    const inviteeEmail = `${seed}-invitee@example.com`;
    const workspaceName = `邀请工作空间 ${seed}`;

    await registerUser(page, {
      email: ownerEmail,
      name: "Invite Owner",
    });
    const workspaceId = await createFirstWorkspace(page, workspaceName);

    await page.goto(`/workspaces/${workspaceId}/members`);
    await expect(
      page.getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Invite", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/members/invite$`),
    );
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId("workspace-invite-email-input").fill(inviteeEmail);
    await expect(
      page.getByRole("checkbox", { name: "Owner", exact: true }),
    ).toBeEnabled();
    await page.getByRole("checkbox", { name: "Member", exact: true }).click();
    await page.getByTestId("workspace-invite-confirm").click();

    const inviteResult = page.getByTestId("workspace-invite-result");
    await expect(inviteResult).toBeVisible();
    const inviteLink = (
      await inviteResult.getByTestId("workspace-invite-link").textContent()
    )?.trim();
    expect(inviteLink).toMatch(
      /\/invite\?invitationId=[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    await expect(
      waitForEmailUrl(
        request,
        inviteeEmail,
        `Invitation to join ${workspaceName}`,
      ),
    ).resolves.toBe(inviteLink);
    await page
      .getByRole("navigation", { name: "Breadcrumbs" })
      .getByRole("link", { name: "Members", exact: true })
      .click();

    const inviteeContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const inviteePage = await inviteeContext.newPage();

    try {
      await inviteePage.goto(inviteLink!);
      await expect(inviteePage).toHaveURL(/\/auth\/login/);

      await inviteePage.getByTestId("auth-tab-register").click();
      await inviteePage.getByTestId("auth-name-input").fill("Accepted Member");
      await inviteePage.getByTestId("auth-email-input").fill(inviteeEmail);
      await inviteePage.getByTestId("auth-password-input").fill(testPassword);
      await inviteePage.getByTestId("auth-submit").click();

      await completeEmailVerification(inviteePage, inviteeEmail);

      await expect(inviteePage).toHaveURL(/\/invite\?invitationId=/);
      await expect(inviteePage.getByTestId("invite-accept-page")).toBeVisible();
      await inviteePage.getByTestId("invite-accept-submit").click();
      await expect(inviteePage).toHaveURL(
        new RegExp(`/workspaces/${workspaceId}$`),
      );
    } finally {
      await inviteeContext.close();
    }

    await page.goto(`/workspaces/${workspaceId}/members`);
    await expect(page.getByTestId(`member-row-${inviteeEmail}`)).toBeVisible();
    await expect(
      page.getByTestId("member-status-active").first(),
    ).toBeVisible();

    const memberRow = page.getByRole("row").filter({
      has: page.getByTestId(`member-row-${inviteeEmail}`),
    });

    await memberRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "Disable" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/members(?:\\?.*)?$`),
    );
  });

  test("redirects removed accepted members away from the inaccessible workspace", async ({
    browser,
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const seed = uniqueSeed("removed-member-refresh");
    const ownerEmail = `${seed}-owner@example.com`;
    const inviteeEmail = `${seed}-invitee@example.com`;
    const workspaceName = `移除成员工作空间 ${seed}`;

    await registerUser(page, {
      email: ownerEmail,
      name: "Invite Owner",
    });
    const workspaceId = await createFirstWorkspace(page, workspaceName);

    await page.goto(`/workspaces/${workspaceId}/members`);
    await expect(
      page.getByRole("heading", { name: "Members", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Invite", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/members/invite$`),
    );
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId("workspace-invite-email-input").fill(inviteeEmail);
    await page.getByRole("checkbox", { name: "Member", exact: true }).click();
    await page.getByTestId("workspace-invite-confirm").click();

    const inviteResult = page.getByTestId("workspace-invite-result");
    await expect(inviteResult).toBeVisible();
    const inviteLink = (
      await inviteResult.getByTestId("workspace-invite-link").textContent()
    )?.trim();
    expect(inviteLink).toMatch(
      /\/invite\?invitationId=[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    await page
      .getByRole("navigation", { name: "Breadcrumbs" })
      .getByRole("link", { name: "Members", exact: true })
      .click();

    const inviteeContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const inviteePage = await inviteeContext.newPage();

    try {
      await inviteePage.goto(inviteLink!);
      await expect(inviteePage).toHaveURL(/\/auth\/login/);

      await inviteePage.getByTestId("auth-tab-register").click();
      await inviteePage.getByTestId("auth-name-input").fill("Removed Member");
      await inviteePage.getByTestId("auth-email-input").fill(inviteeEmail);
      await inviteePage.getByTestId("auth-password-input").fill(testPassword);
      await inviteePage.getByTestId("auth-submit").click();

      await completeEmailVerification(inviteePage, inviteeEmail);

      await expect(inviteePage).toHaveURL(/\/invite\?invitationId=/);
      await expect(inviteePage.getByTestId("invite-accept-page")).toBeVisible();
      await inviteePage.getByTestId("invite-accept-submit").click();
      await expect(inviteePage).toHaveURL(
        new RegExp(`/workspaces/${workspaceId}$`),
      );

      await page.goto(`/workspaces/${workspaceId}/members`);
      const memberRow = page.getByRole("row").filter({
        has: page.getByTestId(`member-row-${inviteeEmail}`),
      });

      await expect(memberRow).toBeVisible();
      await memberRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(page.getByTestId(`member-row-${inviteeEmail}`)).toHaveCount(
        0,
      );

      await inviteePage.reload();
      await expect(inviteePage).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
      await expect(
        inviteePage.getByTestId("user-workspaces-page"),
      ).toBeVisible();
      await expect(
        inviteePage.getByText(
          "useCurrentMemberContext must be used within a CurrentMemberContext",
        ),
      ).toHaveCount(0);
    } finally {
      await inviteeContext.close();
    }
  });

  test("authorizes direct permission editing by ability instead of owner roles", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("member-permission-ability");
    const memberEmail = `${seed}-member@example.com`;
    const memberContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const memberPage = await memberContext.newPage();
    try {
      await registerUser(memberPage, {
        email: memberEmail,
        name: "Permission Editor",
      });
      await registerUser(page, {
        email: `${seed}-owner@example.com`,
        name: "Permission Owner",
      });
      const workspaceId = await createFirstWorkspace(page, `能力授权 ${seed}`);
      const memberId = await addMemberByApi(page, workspaceId, memberEmail);
      const { currentMember } = await graphqlRequest<{
        currentMember: { id: string };
      }>(
        page.request,
        "query { currentMember { id } }",
        {},
        { "x-workspace-id": workspaceId },
      );

      await memberPage.goto(
        `/workspaces/${workspaceId}/members/${currentMember.id}`,
      );
      const permission = memberPage.getByRole("checkbox", {
        name: "Update Workspace",
        exact: true,
      });
      await expect(memberPage.locator("#member-name")).toBeDisabled();
      await expect(permission).toBeDisabled();
      await memberPage.goto(`/workspaces/${workspaceId}/members/invite`);
      await expect(memberPage).toHaveURL(
        new RegExp(`/workspaces/${workspaceId}/members(?:\\?.*)?$`),
      );
      await expect(memberPage.getByTestId("workspace-invite-page")).toHaveCount(
        0,
      );
      await memberPage.goto(
        `/workspaces/${workspaceId}/members/${currentMember.id}`,
      );

      // Direct-permission editors do not need profile-write or role-setting ability.
      await graphqlRequest(
        page.request,
        "mutation ($id: ID!, $input: SetMemberPermissionsInput!) { setMemberPermissions(id: $id, input: $input) { id } }",
        {
          id: memberId,
          input: {
            permissions: ["MEMBER__SET_PERMISSIONS", "WORKSPACE__UPDATE"],
          },
        },
        { "x-workspace-id": workspaceId },
      );
      await memberPage.reload();
      await expect(memberPage.locator("#member-name")).toBeDisabled();
      await expect(
        memberPage.getByRole("checkbox", { name: "Owner", exact: true }),
      ).toBeDisabled();
      await expect(permission).toBeEnabled();
      await permission.click();
      await memberPage.getByTestId("member-permissions-save").click();
      await expect(
        memberPage.getByText("Member updated successfully"),
      ).toBeVisible();
      await permission.click();
      await memberPage.getByTestId("member-permissions-save").click();
      await expect(permission).not.toBeChecked();

      await graphqlRequest(
        page.request,
        "mutation ($id: ID!, $input: SetMemberRolesInput!) { setMemberRoles(id: $id, input: $input) { id } }",
        { id: memberId, input: { roles: ["ADMIN"] } },
        { "x-workspace-id": workspaceId },
      );
      await memberPage.goto(`/workspaces/${workspaceId}/members/${memberId}`);
      await expect(
        memberPage.getByRole("checkbox", { name: "Owner", exact: true }),
      ).toBeDisabled();
      await memberPage.goto(`/workspaces/${workspaceId}/members`);
      await memberPage
        .getByRole("link", { name: "Invite", exact: true })
        .click();
      await expect(
        memberPage.getByRole("checkbox", { name: "Admin", exact: true }),
      ).toBeEnabled();
      await expect(
        memberPage.getByRole("checkbox", { name: "Owner", exact: true }),
      ).toHaveCount(0);
      await memberPage
        .getByTestId("workspace-invite-email-input")
        .fill(`${seed}-invited@example.com`);
      await memberPage
        .getByRole("checkbox", { name: "Member", exact: true })
        .click();
      await memberPage.getByTestId("workspace-invite-confirm").click();
      await expect(
        memberPage.getByTestId("workspace-invite-link"),
      ).toBeVisible();
      await memberPage.goto(
        `/workspaces/${workspaceId}/members/${currentMember.id}`,
      );
      // An existing owner role stays selected and may be removed, not silently discarded.
      await expect(
        memberPage.getByRole("checkbox", { name: "Owner", exact: true }),
      ).toBeEnabled();
      await expect(memberPage.locator("#member-name")).toBeEnabled();
      await memberPage.locator("#member-name").fill("Shared owner name");
      await memberPage
        .locator("#member-email")
        .fill("owner-contact@example.com");
      await expect(permission).toBeEnabled();
      await permission.click();
      await memberPage.getByTestId("member-profile-save").click();
      await memberPage.getByTestId("member-permissions-save").click();
      await expect(
        memberPage.getByText("Member updated successfully").first(),
      ).toBeVisible();
      await memberPage.reload();
      await expect(permission).toBeChecked();
      await expect(permission).toBeEnabled();

      const { member } = await graphqlRequest<{
        member: {
          permissions: Array<string>;
          roles: Array<string>;
          name: string;
          email: string;
        };
      }>(
        page.request,
        "query ($id: ID!) { member(id: $id) { permissions roles name email } }",
        { id: currentMember.id },
        { "x-workspace-id": workspaceId },
      );
      expect(member.permissions).toEqual(["WORKSPACE__UPDATE"]);
      expect(member.roles).toEqual(["OWNER"]);
      expect(member.name).toBe("Shared owner name");
      expect(member.email).toBe("owner-contact@example.com");
    } finally {
      await memberContext.close();
    }
  });

  test("edits member roles and direct permissions", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("member-authorization");
    const ownerEmail = `${seed}-owner@example.com`;
    const memberEmail = `${seed}-member@example.com`;
    const workspaceName = `成员权限工作空间 ${seed}`;
    const renamedWorkspace = `成员已更新 ${seed}`;
    const memberContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const memberPage = await memberContext.newPage();

    try {
      await registerUser(memberPage, {
        email: memberEmail,
        name: "Authorized Member",
      });
      await registerUser(page, {
        email: ownerEmail,
        name: "Authorization Owner",
      });
      const workspaceId = await createFirstWorkspace(page, workspaceName);
      const memberId = await addMemberByApi(page, workspaceId, memberEmail);

      await memberPage.goto(`/workspaces/${workspaceId}/settings`);
      await memberPage
        .getByTestId("workspace-settings-name-input")
        .fill(renamedWorkspace);
      await expect(
        memberPage.getByTestId("workspace-settings-save"),
      ).toBeDisabled();

      await page.goto(`/workspaces/${workspaceId}/members/${memberId}`);
      await expect(page.getByTestId("member-detail-page")).toBeVisible();
      await page.getByRole("checkbox", { name: "Admin", exact: true }).click();
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
        "Authorized Member",
      );
      await expect(
        page.getByLabel("Name", { exact: true }),
      ).not.toHaveAttribute("readonly", "");
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
        memberEmail,
      );
      await expect(
        page.getByLabel("Email", { exact: true }),
      ).not.toHaveAttribute("readonly", "");
      await page.getByRole("checkbox", { name: "Member", exact: true }).click();
      await page.getByLabel("Name", { exact: true }).fill("Workspace Member");
      await page
        .getByLabel("Email", { exact: true })
        .fill(`public-${memberEmail}`);
      await page
        .getByRole("checkbox", { name: "Update Workspace", exact: true })
        .click();
      let roleWrites = 0;
      let permissionWrites = 0;
      page.on("request", (request) => {
        const body = request.postData() ?? "";
        if (body.includes("setMemberRolesFromMemberRoute")) roleWrites++;
        if (body.includes("setMemberPermissionsFromMemberRoute"))
          permissionWrites++;
      });
      await page.getByTestId("member-profile-save").click();
      await expect(
        page.getByRole("heading", { name: "Workspace Member", exact: true }),
      ).toBeVisible();
      expect(roleWrites).toBe(0);
      expect(permissionWrites).toBe(0);
      // Saving one form preserves unsaved changes in the other forms.
      await expect(
        page.getByRole("checkbox", { name: "Admin", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "Update Workspace", exact: true }),
      ).toBeChecked();
      await page.route("**/api/graphql", async (route) => {
        if (
          !route.request().postData()?.includes("setMemberRolesFromMemberRoute")
        )
          return route.continue();
        await route.fulfill({
          json: {
            data: null,
            errors: [
              {
                message: "Role change rejected",
                extensions: { code: "BAD_USER_INPUT" },
              },
            ],
          },
        });
      });
      await page.getByTestId("member-roles-save").click();
      await expect(page.getByText("Role change rejected")).toBeVisible();
      await page.unrouteAll({ behavior: "wait" });
      const unchanged = await graphqlRequest<{
        member: {
          name: string;
          roles: Array<string>;
          permissions: Array<string>;
        };
      }>(
        page.request,
        "query ($id: ID!) { member(id: $id) { name roles permissions } }",
        { id: memberId },
        { "x-workspace-id": workspaceId },
      );
      expect(unchanged.member).toEqual({
        name: "Workspace Member",
        roles: ["MEMBER"],
        permissions: [],
      });
      await expect(
        page.getByRole("checkbox", { name: "Admin", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "Update Workspace", exact: true }),
      ).toBeChecked();
      await page.getByTestId("member-roles-save").click();
      await expect.poll(() => roleWrites).toBe(2);
      expect(permissionWrites).toBe(0);
      await page.getByTestId("member-permissions-save").click();
      await expect.poll(() => permissionWrites).toBe(1);

      await expect(
        page.getByRole("heading", { name: "Workspace Member", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
        "Workspace Member",
      );
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
        `public-${memberEmail}`,
      );
      await expect(
        page.getByRole("checkbox", { name: "Admin", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByRole("checkbox", { name: "Update Workspace", exact: true }),
      ).toBeChecked();

      // A profile-only second save must not replay the previous authorization writes.
      await page
        .getByLabel("Name", { exact: true })
        .fill("Updated Workspace Member");
      await page.getByTestId("member-profile-save").click();
      await expect(
        page.getByRole("heading", {
          name: "Updated Workspace Member",
          exact: true,
        }),
      ).toBeVisible();
      expect(roleWrites).toBe(2);
      expect(permissionWrites).toBe(1);

      await page.getByRole("checkbox", { name: "Member", exact: true }).click();
      await page.getByRole("checkbox", { name: "Admin", exact: true }).click();
      const rolesSaved = page.waitForResponse(
        (response) =>
          response
            .request()
            .postData()
            ?.includes("setMemberRolesFromMemberRoute") === true,
      );
      await page.getByTestId("member-roles-save").click();
      expect((await (await rolesSaved).json()).errors).toBeUndefined();

      await expect.poll(() => roleWrites).toBe(3);

      await memberPage.reload();
      await memberPage
        .getByTestId("workspace-settings-name-input")
        .fill(renamedWorkspace);
      await expect(
        memberPage.getByTestId("workspace-settings-save"),
      ).toBeEnabled();
      await memberPage.getByTestId("workspace-settings-save").click();
      await expect(memberPage.getByText("Workspace updated")).toBeVisible();

      const { currentMember } = await graphqlRequest<{
        currentMember: { id: string };
      }>(
        page.request,
        "query { currentMember { id } }",
        {},
        { "x-workspace-id": workspaceId },
      );
      await page.goto(`/workspaces/${workspaceId}/members/${currentMember.id}`);
      await page.getByRole("checkbox", { name: "Member", exact: true }).click();
      await page.getByRole("checkbox", { name: "Owner", exact: true }).click();
      await page.getByTestId("member-roles-save").click();
      await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
      await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
    } finally {
      await memberContext.close();
    }
  });
});
