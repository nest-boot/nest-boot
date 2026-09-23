import { expect, test } from "@playwright/test";

import { signInAsE2eAdministrator, testPassword } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";

test("filters administrator users and preserves filters across pagination and reloads", async ({
  page,
}) => {
  const seed = uniqueSeed("user-filter");
  const name = `Filter users ${seed}`;
  await signInAsE2eAdministrator(page);
  for (let index = 0; index < 3; index += 1) {
    await graphqlRequest(
      page.request,
      "mutation($input: CreateUserInput!) { createUser(input: $input) { id } }",
      {
        input: {
          name,
          email: `${seed}-${index}@example.com`,
          password: testPassword,
        },
      },
    );
  }

  await page.goto("/admin/users");
  const search = page.getByRole("textbox", { name: "搜索", exact: true });
  const rows = page.getByRole("row").filter({ hasText: name });
  await search.fill(`${seed}*`);
  await search.press("Enter");
  await expect(rows).toHaveCount(3);

  const smallPageUrl = new URL(page.url());
  smallPageUrl.searchParams.set("first", "2");
  await page.goto(smallPageUrl.href);
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(rows).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("after")).toBeTruthy();

  await page.getByRole("button", { name: "添加筛选", exact: true }).click();
  await page.getByRole("menuitem", { name: "名称", exact: true }).click();
  const nameFilter = page.getByRole("textbox", { name: "名称", exact: true });
  await nameFilter.fill(name);
  await nameFilter.press("Enter");
  await page.keyboard.press("Escape");
  await expect(rows).toHaveCount(3);
  expect(new URL(page.url()).searchParams.has("after")).toBe(false);
  expect(new URL(page.url()).searchParams.get("query")).toBe(`${seed}*`);

  const filteredPageUrl = new URL(page.url());
  filteredPageUrl.searchParams.set("first", "2");
  await page.goto(filteredPageUrl.href);
  await expect(rows).toHaveCount(2);
  const filterParam = new URL(page.url()).searchParams.get("filter");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(rows).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("filter")).toBe(filterParam);
  await page.getByRole("button", { name: "上一页", exact: true }).click();
  await expect(rows).toHaveCount(2);
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(search).toHaveValue(`${seed}*`);
  expect(new URL(page.url()).searchParams.get("filter")).toBe(filterParam);

  await page.getByRole("button", { name: "添加筛选", exact: true }).click();
  await page.getByRole("menuitem", { name: "邮箱", exact: true }).click();
  const email = `${seed}-0@example.com`;
  const emailFilter = page.getByRole("textbox", { name: "邮箱", exact: true });
  await emailFilter.fill(email);
  await emailFilter.press("Enter");
  await page.keyboard.press("Escape");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(email);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(email);

  const dateUrl = new URL(page.url());
  dateUrl.searchParams.set(
    "filter",
    JSON.stringify({
      name: { $eq: name },
      created_at: { $lte: "2000-01-01T00:00:00.000Z" },
    }),
  );
  const dateResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/graphql") &&
      response.request().postDataJSON()?.operationName ===
        "getUsersFromUsersRoute",
  );
  await page.goto(dateUrl.href);
  expect((await (await dateResponse).json()).errors).toBeUndefined();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("没有找到项目", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^创建时间 / }).click();
  await page.getByRole("button", { name: "移除筛选", exact: true }).click();
  await expect(rows).toHaveCount(3);
});
