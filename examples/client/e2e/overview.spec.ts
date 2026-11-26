import { expect, test } from "@playwright/test";
import { registerUserByApi, signInAsE2eAdministrator } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import {
  addWorkspaceMemberByApi,
  createWorkspaceByApi,
} from "./utils/workspace";
import type { Page } from "@playwright/test";

function sidebarOverview(page: Page) {
  return page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { name: "Overview", exact: true });
}

test("user overview keeps profile and security separate with exact navigation", async ({
  page,
}) => {
  await registerUserByApi(page.request, {
    email: `${uniqueSeed("user-overview")}@example.com`,
    name: "Overview user",
  });
  await createWorkspaceByApi(page, "Overview workspace");
  await page.goto("/user");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Edit profile", exact: true }).click();
  await expect(page).toHaveURL(/\/user\/profile$/);
  await expect(sidebarOverview(page)).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Security", exact: true }).click();
  await expect(page).toHaveURL(/\/user\/security$/);
  await expect(sidebarOverview(page)).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/user$/);
  await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
});

test("admin overview is the menu destination and uses exact sidebar matching", async ({
  page,
}) => {
  await signInAsE2eAdministrator(page);
  await page.goto("/user");
  await page
    .getByRole("button", {
      name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Administration", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Manage users", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(sidebarOverview(page)).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("workspace overviews switch workspaces and respect read permissions", async ({
  page,
  browser,
}) => {
  const seed = uniqueSeed("workspace-overview");
  await registerUserByApi(page.request, {
    email: `${seed}@example.com`,
    name: "Overview owner",
  });
  const first = await createWorkspaceByApi(page, "First overview workspace");
  const second = await createWorkspaceByApi(page, "Second overview workspace");
  const context = await browser.newContext({ locale: "en-US" });
  const memberPage = await context.newPage();
  try {
    const email = `${seed}-member@example.com`;
    await registerUserByApi(memberPage.request, {
      email,
      name: "Overview member",
    });
    const memberId = await addWorkspaceMemberByApi(page, first.id, email);
    await graphqlRequest(
      page.request,
      `mutation ($id: ID!, $input: SetWorkspaceMemberPermissionsInput!) {
      setWorkspaceMemberPermissions(id: $id, input: $input) { id }
    }`,
      { id: memberId, input: { permissions: [] } },
      { "x-workspace": first.id },
    );
    await page.goto("/user/workspaces");
    await page.getByRole("link", { name: first.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${first.id}$`));
    await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(sidebarOverview(page)).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator('[data-slot="page-pagination"]')).toHaveCount(0);
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page
      .getByRole("menuitemradio", { name: second.name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${second.id}$`));
    await memberPage.goto(`/workspaces/${first.id}`);
    await expect(
      memberPage.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
    await expect(
      memberPage.getByRole("link", { name: "View API keys", exact: true }),
    ).toHaveCount(0);
    await expect(
      memberPage.getByRole("link", { name: "Manage members", exact: true }),
    ).toBeVisible();
    await expect(memberPage.getByRole("alert")).toHaveCount(0);
    await expect(
      memberPage.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
