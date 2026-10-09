import { expect, test } from "@playwright/test";
import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { clickPageAction } from "./utils/page-actions";
import { getPermissionCheckbox } from "./utils/permissions";
import { uniqueSeed } from "./utils/unique";
import { addMemberByApi, createWorkspaceByApi } from "./utils/workspace";

test("creates service accounts with default, role and direct permission grants", async ({
  page,
}) => {
  const seed = uniqueSeed("service-account");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Service account owner",
  });
  const workspace = await createWorkspaceByApi(page, seed);
  const path = `/workspaces/${workspace.id}/members`;
  await page.goto(`${path}?query=${seed}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Create", exact: true }),
  ).toHaveAttribute("data-slot", "page-secondary-action");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(`${path}/create-service-account`);
  const back = page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true });
  expect(
    new URL((await back.getAttribute("href"))!, page.url()).searchParams.get(
      "query",
    ),
  ).toBe(seed);

  for (const variant of ["default", "role", "permissions"] as const) {
    await page.goto(`${path}/create-service-account`);
    await page.reload();
    const name = `${seed} ${variant}`;
    await page.getByLabel("Name", { exact: true }).fill(name);
    if (variant === "role") {
      await page.getByRole("checkbox", { name: "Member", exact: true }).check();
    }
    if (variant !== "default")
      await getPermissionCheckbox(page, "WORKSPACE__READ").check();
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}/[0-9]+$`));
    const memberId = new URL(page.url()).pathname.split("/").at(-1)!;
    const data = await graphqlRequest<{
      member: {
        name: string;
        type: string;
        roles: Array<string>;
        permissions: Array<string>;
      };
    }>(
      page.request,
      `query ($id: ID!) { member(id: $id) { name type roles permissions } }`,
      { id: memberId },
      { "x-workspace-id": workspace.id },
    );
    expect(data.member).toEqual({
      name,
      type: "SERVICE_ACCOUNT",
      roles: variant === "permissions" ? [] : ["MEMBER"],
      permissions: variant === "default" ? [] : ["WORKSPACE__READ"],
    });
    await expect(page.locator('[data-slot="card-header"]')).toHaveCount(0);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  }
  await page.goto(path);
  const row = page.getByRole("row").filter({ hasText: `${seed} permissions` });
  const roleCell = row.getByRole("cell").nth(2);
  await expect(roleCell).toHaveText("-");
  await expect(roleCell.locator('[data-slot="badge"]')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await clickPageAction(page, "Create");
  await expect(page).toHaveURL(`${path}/create-service-account`);
});

test("guards service account creation and limits available grants", async ({
  page,
  browser,
}) => {
  const seed = uniqueSeed("service-account-grants");
  await registerUser(page, {
    email: `${seed}-owner@example.com`,
    name: "Owner",
  });
  const workspace = await createWorkspaceByApi(page, seed);
  const context = await browser.newContext();
  try {
    const issuer = await context.newPage();
    const email = `${seed}-issuer@example.com`;
    await registerUser(issuer, { email, name: "Issuer" });
    const memberId = await addMemberByApi(page, workspace.id, email);
    const path = `/workspaces/${workspace.id}/members`;
    await issuer.goto(`${path}/create-service-account`);
    await expect(issuer).toHaveURL((url) => url.pathname === path);
    await expect(
      issuer.getByRole("link", { name: "Create", exact: true }),
    ).toHaveCount(0);
    await graphqlRequest(
      page.request,
      `mutation ($id: ID!, $input: SetMemberPermissionsInput!) { setMemberPermissions(id: $id, input: $input) { id } }`,
      {
        id: memberId,
        input: {
          permissions: [
            "SERVICE_ACCOUNT__READ",
            "SERVICE_ACCOUNT__WRITE",
            "MEMBER__SET_ROLES",
            "MEMBER__SET_PERMISSIONS",
          ],
        },
      },
      { "x-workspace-id": workspace.id },
    );
    await issuer.goto(`${path}/create-service-account`);
    await expect(
      issuer.getByRole("heading", {
        name: "Create service account",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      issuer.getByRole("checkbox", { name: "Owner", exact: true }),
    ).toBeDisabled();
    await expect(
      issuer.getByRole("checkbox", { name: "Admin", exact: true }),
    ).toBeDisabled();
    await expect(
      getPermissionCheckbox(issuer, "WORKSPACE__DELETE"),
    ).toBeDisabled();
    await expect(
      getPermissionCheckbox(issuer, "WORKSPACE__READ"),
    ).toBeEnabled();
    await getPermissionCheckbox(issuer, "WORKSPACE__READ").check();
    await issuer.getByLabel("Name", { exact: true }).fill(seed);
    await issuer.getByRole("button", { name: "Create", exact: true }).click();
    await expect(issuer).toHaveURL(new RegExp(`${path}/[0-9]+$`));
  } finally {
    await context.close();
  }
});
