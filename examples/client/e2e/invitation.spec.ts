import { expect, test } from "@playwright/test";

import { registerUser, testPassword } from "./utils/auth";
import { createFirstWorkspace } from "./utils/workspace";
import { uniqueSeed } from "./utils/unique";

test.describe("workspace invitations", () => {
  test("removes a pending invite from the detail page and refreshes the members list", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const seed = uniqueSeed("delete-invite");
    const ownerEmail = `${seed}-owner@example.com`;
    const inviteeEmail = `${seed}-invitee@example.com`;
    const workspaceName = `删除邀请工作空间 ${seed}`;

    await registerUser(page, {
      email: ownerEmail,
      name: "Invite Owner",
    });
    const workspaceId = await createFirstWorkspace(page, workspaceName);

    await page.goto(`/workspaces/${workspaceId}/members`);
    await expect(page.getByTestId("workspace-members-page")).toBeVisible();

    await page.getByTestId("workspace-members-invite-action").click();
    await page.getByTestId("workspace-invite-email-input").fill(inviteeEmail);
    await page.getByTestId("workspace-invite-confirm").click();
    await page.getByTestId("workspace-invite-link-close").click();

    const memberRow = page.getByRole("row").filter({
      has: page.getByTestId(`workspace-member-row-${inviteeEmail}`),
    });

    await expect(memberRow).toBeVisible();
    await memberRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await expect(page.getByTestId("alert-dialog")).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/members(?:\\?.*)?$`),
    );
    await page.getByTestId("alert-dialog-cancel").click();

    await page.getByTestId(`workspace-member-row-${inviteeEmail}`).click();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByTestId("alert-dialog-confirm").click();

    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/members(?:\\?.*)?$`),
    );
    await expect(
      page.getByTestId(`workspace-member-row-${inviteeEmail}`),
    ).toHaveCount(0);
  });

  test("invites a member and accepts the invite through registration", async ({
    browser,
    context,
    page,
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
    await expect(page.getByTestId("workspace-members-page")).toBeVisible();

    await page.getByTestId("workspace-members-invite-action").click();
    await page.getByTestId("workspace-invite-email-input").fill(inviteeEmail);
    await page.getByTestId("workspace-invite-confirm").click();

    const inviteDialog = page.getByTestId("workspace-invite-link-dialog");
    await expect(inviteDialog).toBeVisible();
    const inviteLink = (
      await inviteDialog.getByTestId("workspace-invite-link").textContent()
    )?.trim();
    expect(inviteLink).toMatch(/\/invite\?token=[a-f0-9]+$/);
    await inviteDialog.getByTestId("workspace-invite-link-close").click();

    const inviteeContext = await browser.newContext({
      locale: "zh-CN",
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

      await expect(inviteePage).toHaveURL(/\/invite\?token=/);
      await expect(inviteePage.getByTestId("invite-accept-page")).toBeVisible();
      await inviteePage.getByTestId("invite-accept-submit").click();
      await expect(inviteePage).toHaveURL(
        new RegExp(`/workspaces/${workspaceId}/settings$`),
      );
    } finally {
      await inviteeContext.close();
    }

    await page.goto(`/workspaces/${workspaceId}/members`);
    await expect(
      page.getByTestId(`workspace-member-row-${inviteeEmail}`),
    ).toBeVisible();
    await expect(
      page.getByTestId("workspace-member-status-active").first(),
    ).toBeVisible();

    const memberRow = page.getByRole("row").filter({
      has: page.getByTestId(`workspace-member-row-${inviteeEmail}`),
    });

    await memberRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "禁用" }).click();
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
    await expect(page.getByTestId("workspace-members-page")).toBeVisible();

    await page.getByTestId("workspace-members-invite-action").click();
    await page.getByTestId("workspace-invite-email-input").fill(inviteeEmail);
    await page.getByTestId("workspace-invite-confirm").click();

    const inviteDialog = page.getByTestId("workspace-invite-link-dialog");
    await expect(inviteDialog).toBeVisible();
    const inviteLink = (
      await inviteDialog.getByTestId("workspace-invite-link").textContent()
    )?.trim();
    expect(inviteLink).toMatch(/\/invite\?token=[a-f0-9]+$/);
    await inviteDialog.getByTestId("workspace-invite-link-close").click();

    const inviteeContext = await browser.newContext({
      locale: "zh-CN",
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

      await expect(inviteePage).toHaveURL(/\/invite\?token=/);
      await expect(inviteePage.getByTestId("invite-accept-page")).toBeVisible();
      await inviteePage.getByTestId("invite-accept-submit").click();
      await expect(inviteePage).toHaveURL(
        new RegExp(`/workspaces/${workspaceId}/settings$`),
      );

      await page.goto(`/workspaces/${workspaceId}/members`);
      const memberRow = page.getByRole("row").filter({
        has: page.getByTestId(`workspace-member-row-${inviteeEmail}`),
      });

      await expect(memberRow).toBeVisible();
      await memberRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "删除" }).click();
      await page.getByTestId("alert-dialog-confirm").click();
      await expect(
        page.getByTestId(`workspace-member-row-${inviteeEmail}`),
      ).toHaveCount(0);

      await inviteePage.reload();
      await expect(inviteePage).toHaveURL(/\/workspaces$/);
      await expect(
        inviteePage.getByTestId("workspace-empty-state"),
      ).toBeVisible();
      await expect(
        inviteePage.getByText(
          "useCurrentWorkspaceMemberContext must be used within a CurrentWorkspaceMemberContext",
        ),
      ).toHaveCount(0);
    } finally {
      await inviteeContext.close();
    }
  });
});
