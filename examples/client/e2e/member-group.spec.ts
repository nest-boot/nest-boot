import { expect, test } from "@playwright/test";

import { registerUser, registerUserByApi } from "./utils/auth";
import {
  addWorkspaceMemberByApi,
  createFirstWorkspace,
} from "./utils/workspace";
import { uniqueSeed } from "./utils/unique";

test.describe("workspace member groups", () => {
  test("creates, edits, assigns members to, and deletes a member group", async ({
    page,
    request,
  }) => {
    const seed = uniqueSeed("group");
    const memberName = "Group Member";
    const memberEmail = `${seed}-member@example.com`;
    const groupName = `成员组 ${seed}`;
    const renamedGroupName = `重命名成员组 ${seed}`;

    await registerUser(page, {
      email: `${seed}-owner@example.com`,
      name: "Group Owner",
    });
    const workspaceId = await createFirstWorkspace(
      page,
      `成员组工作空间 ${seed}`,
    );

    await registerUserByApi(request, {
      email: memberEmail,
      name: memberName,
    });
    const memberId = await addWorkspaceMemberByApi(
      page,
      workspaceId,
      memberEmail,
    );

    await page.goto(`/workspaces/${workspaceId}/member-groups`);
    await expect(page.getByTestId("member-groups-page")).toBeVisible();
    await page.getByTestId("member-group-create-action").click();

    await page.getByTestId("member-group-create-name-input").fill(groupName);
    await page
      .getByTestId("member-group-create-description-input")
      .fill("由 Playwright 创建的成员组");
    await page.getByTestId("member-group-create-submit").click();

    await expect(page).toHaveURL(/\/member-groups\/\d+$/);
    await expect(page.getByTestId("member-group-name-input")).toHaveValue(
      groupName,
    );

    await page.getByTestId("member-group-name-input").fill(renamedGroupName);
    await page.getByTestId("member-group-save").click();
    await expect(page.getByTestId("member-group-name-input")).toHaveValue(
      renamedGroupName,
    );

    await page.getByTestId("member-group-members-tab").click();
    const addMemberAction = page.getByTestId("member-group-add-member-action");
    const addMemberDialog = page.getByTestId("member-group-add-member-dialog");
    await expect(addMemberAction).toBeVisible();
    await expect(addMemberAction).toBeEnabled();
    await expect(async () => {
      await addMemberAction.click();
      await expect(addMemberDialog).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await expect(addMemberDialog).toBeVisible();
    const addMemberButton = addMemberDialog.getByTestId(
      `member-group-add-member-${memberId}`,
    );
    await expect(addMemberButton).toBeVisible();
    await addMemberButton.click();
    await page.keyboard.press("Escape");
    await expect(addMemberDialog).toBeHidden();

    await expect(
      page.getByTestId(`member-group-added-member-${memberId}`),
    ).toBeVisible();
    await page.getByTestId(`member-group-remove-member-${memberId}`).click();
    await page.getByTestId("alert-dialog-confirm").click();
    await expect(
      page.getByTestId(`member-group-added-member-${memberId}`),
    ).toBeHidden();

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByTestId("alert-dialog-confirm").click();

    await expect(page).toHaveURL(
      new RegExp(`/workspaces/${workspaceId}/member-groups(\\?.*)?$`),
    );
    await expect(
      page.getByTestId(`member-group-row-${renamedGroupName}`),
    ).toBeHidden();
  });
});
