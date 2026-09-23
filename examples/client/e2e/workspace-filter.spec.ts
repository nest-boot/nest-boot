import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";

test("filters workspaces, preserves pagination state, and opens rows without an arrow action", async ({
  page,
}) => {
  const name = uniqueSeed("workspace-filter");
  await registerUser(page, {
    email: `${name}@example.com`,
    name: "Workspace filter owner",
  });
  for (let index = 0; index < 3; index += 1) {
    await createWorkspaceByApi(page, name);
  }
  const other = await createWorkspaceByApi(page, `${name}-other`);

  await page.goto("/user/workspaces");
  const links = page.locator('[data-testid^="user-workspace-row-"]');
  const search = page.getByRole("textbox", { name: "搜索", exact: true });
  await expect(links).toHaveCount(4);
  await expect(page.getByRole("columnheader")).toHaveCount(3);
  await search.fill(name);
  await search.press("Enter");
  await expect(links).toHaveCount(3);

  const smallPageUrl = new URL(page.url());
  smallPageUrl.searchParams.set("first", "2");
  await page.goto(smallPageUrl.href);
  await expect(links).toHaveCount(2);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(links).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("after")).toBeTruthy();

  await page.getByRole("button", { name: "添加筛选", exact: true }).click();
  await page.getByRole("menuitem", { name: "名称", exact: true }).click();
  const nameFilter = page.getByRole("textbox", { name: "名称", exact: true });
  await nameFilter.fill(name);
  await nameFilter.press("Enter");
  await page.keyboard.press("Escape");
  await expect(links).toHaveCount(3);
  expect(new URL(page.url()).searchParams.has("after")).toBe(false);
  expect(new URL(page.url()).searchParams.get("query")).toBe(name);

  const filteredPageUrl = new URL(page.url());
  filteredPageUrl.searchParams.set("first", "2");
  await page.goto(filteredPageUrl.href);
  await expect(links).toHaveCount(2);
  const filterParam = new URL(page.url()).searchParams.get("filter");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(links).toHaveCount(1);
  await page.getByRole("button", { name: "上一页", exact: true }).click();
  await expect(links).toHaveCount(2);
  await page.reload();
  await expect(links).toHaveCount(2);
  await expect(search).toHaveValue(name);
  expect(new URL(page.url()).searchParams.get("filter")).toBe(filterParam);

  await search.fill("");
  await search.press("Enter");
  await expect(links).toHaveCount(3);
  await page.getByRole("button", { name: /^名称 / }).click();
  await nameFilter.fill(other.name);
  await nameFilter.press("Enter");
  await page.keyboard.press("Escape");
  await expect(links).toHaveCount(1);
  const target = page.getByTestId(`user-workspace-row-${other.id}`);
  await expect(target).toBeVisible();

  const row = page.getByRole("row").filter({ has: target });
  await expect(row.getByRole("button")).toHaveCount(0);
  await row.getByRole("cell").nth(2).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${other.id}/settings$`));
  await page.goBack();
  await expect(target).toBeVisible();
  await target.focus();
  await target.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/workspaces/${other.id}/settings$`));
  await page.goBack();
  await expect(target).toBeVisible();

  const dateUrl = new URL(page.url());
  dateUrl.searchParams.set(
    "filter",
    JSON.stringify({
      name: { $eq: other.name },
      created_at: { $lte: "2000-01-01T00:00:00.000Z" },
    }),
  );
  const dateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/graphql") &&
      response.request().postDataJSON()?.operationName ===
        "getWorkspacesFromUserWorkspacesRoute",
  );
  await page.goto(dateUrl.href);
  expect((await (await dateResponse).json()).errors).toBeUndefined();
  await expect(links).toHaveCount(0);
  await expect(page.getByText("没有找到项目", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^创建时间 / }).click();
  await page.getByRole("button", { name: "移除筛选", exact: true }).click();
  await expect(target).toBeVisible();
});
