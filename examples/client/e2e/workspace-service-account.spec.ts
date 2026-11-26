import { expect, test } from "@playwright/test";
import { registerUser, registerUserByApi } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { clickPageAction } from "./utils/page-actions";
import { getPermissionCheckbox } from "./utils/permissions";
import { uniqueSeed } from "./utils/unique";
import {
  addWorkspaceMemberByApi,
  createWorkspaceByApi,
} from "./utils/workspace";

test("validates service account names and preserves grants when creation is retried", async ({
  page,
}) => {
  await registerUserByApi(page.request, {
    email: `${uniqueSeed("service-form")}@example.com`,
    name: "Service account owner",
  });
  const workspace = await createWorkspaceByApi(page, "Service form workspace");
  await page.goto(`/workspaces/${workspace.id}/members/create-service-account`);
  let attempts = 0;
  await page.route("**/api/graphql", async (route) => {
    if (
      !route
        .request()
        .postData()
        ?.includes("addWorkspaceServiceAccountFromWorkspaceMembersRoute")
    )
      return route.continue();
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        json: { errors: [{ message: "Temporary service account failure" }] },
      });
    return route.continue();
  });
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("   ");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  expect(attempts).toBe(0);
  await name.fill("Retry service account");
  await page.getByRole("checkbox", { name: "Member", exact: true }).check();
  await getPermissionCheckbox(page, "WORKSPACE__READ").check();
  await name.press("Enter");
  await expect(
    page.getByText("Temporary service account failure", { exact: true }),
  ).toBeVisible();
  await expect(name).toHaveValue("Retry service account");
  await expect(
    page.getByRole("checkbox", { name: "Member", exact: true }),
  ).toBeChecked();
  await expect(getPermissionCheckbox(page, "WORKSPACE__READ")).toBeChecked();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/workspaces/${workspace.id}/members/[0-9]+$`),
  );
  expect(attempts).toBe(2);
});

for (const language of ["en", "zh"]) {
  test(`shows localized TanStack length validation in ${language}`, async ({
    page,
  }) => {
    await registerUser(page, {
      email: `${uniqueSeed(`service-validation-${language}`)}@example.com`,
      name: "Service validation owner",
    });
    const workspace = await createWorkspaceByApi(
      page,
      "Localized validation workspace",
    );
    await page.evaluate(
      (lng) => localStorage.setItem("i18nextLng", lng),
      language,
    );
    await page.goto(
      `/workspaces/${workspace.id}/members/create-service-account`,
    );
    const name = page.getByLabel(language === "en" ? "Name" : "姓名", {
      exact: true,
    });
    // Bypass the native maxlength to exercise TanStack's schema validation.
    await name.evaluate((input: HTMLInputElement, value) => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setValue.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, "a".repeat(256));
    await expect(name).toHaveValue("a".repeat(256));
    await page
      .getByRole("button", {
        name: language === "en" ? "Create" : "创建",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        language === "en"
          ? "Use at most 255 characters."
          : "最多输入 255 个字符。",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
  });
}

test("creates service accounts with default, role and direct permission grants", async ({
  page,
}) => {
  const seed = uniqueSeed("service-account");
  await registerUserByApi(page.request, {
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
      workspaceMember: {
        name: string;
        type: string;
        roles: Array<string>;
        permissions: Array<string>;
      };
    }>(
      page.request,
      `query ($id: ID!) { workspaceMember(id: $id) { name type roles permissions } }`,
      { id: memberId },
      { "x-workspace": workspace.id },
    );
    expect(data.workspaceMember).toEqual({
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
  await registerUserByApi(page.request, {
    email: `${seed}-owner@example.com`,
    name: "Owner",
  });
  const workspace = await createWorkspaceByApi(page, seed);
  const context = await browser.newContext();
  try {
    const issuer = await context.newPage();
    const email = `${seed}-issuer@example.com`;
    await registerUserByApi(issuer.request, { email, name: "Issuer" });
    const memberId = await addWorkspaceMemberByApi(page, workspace.id, email);
    const path = `/workspaces/${workspace.id}/members`;
    await issuer.goto(`${path}/create-service-account`);
    await expect(issuer).toHaveURL((url) => url.pathname === path);
    await expect(
      issuer.getByRole("link", { name: "Create", exact: true }),
    ).toHaveCount(0);
    await graphqlRequest(
      page.request,
      `mutation ($id: ID!, $input: SetWorkspaceMemberPermissionsInput!) { setWorkspaceMemberPermissions(id: $id, input: $input) { id } }`,
      {
        id: memberId,
        input: {
          permissions: [
            "WORKSPACE_SERVICE_ACCOUNT__READ",
            "WORKSPACE_SERVICE_ACCOUNT__WRITE",
            "WORKSPACE_MEMBER__SET_ROLES",
            "WORKSPACE_MEMBER__SET_PERMISSIONS",
          ],
        },
      },
      { "x-workspace": workspace.id },
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
