import { expect, test } from "@playwright/test";
import {
  registerUser,
  signInAsE2eAdministrator,
  testPassword,
} from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { addMemberByApi, createWorkspaceByApi } from "./utils/workspace";
import type { Page } from "@playwright/test";

const dateFilter = { created_at: { $gte: "2000-01-01T00:00:00.000Z" } };

function filteredPath(
  path: string,
  query: string,
  field = "ID",
  direction = "ASC",
) {
  return `${path}?${new URLSearchParams({
    first: "1",
    query,
    filter: JSON.stringify(dateFilter),
    orderBy: JSON.stringify({ field, direction }),
  })}`;
}

function readSearch(page: Page) {
  return Object.fromEntries(new URL(page.url()).searchParams);
}

async function backToList(page: Page) {
  await page.locator('[data-slot="page-breadcrumb-actions"] a').last().click();
}

async function createUsers(page: Page, seed: string) {
  const users: Array<{ id: string; name: string; email: string }> = [];
  for (const letter of ["A", "B", "C"]) {
    const { createUser } = await graphqlRequest<{
      createUser: { id: string };
    }>(
      page.request,
      "mutation($input: CreateUserInput!) { createUser(input: $input) { id } }",
      {
        input: {
          name: `${seed} ${letter}`,
          email: `${seed}-${letter.toLowerCase()}@example.com`,
          password: testPassword,
        },
      },
    );
    users.push({
      ...createUser,
      name: `${seed} ${letter}`,
      email: `${seed}-${letter.toLowerCase()}@example.com`,
    });
  }
  return users;
}

test("administrator users restore create searches and navigate filtered details across pages", async ({
  page,
}) => {
  const seed = uniqueSeed("user-navigation");
  await signInAsE2eAdministrator(page);
  const [a, b, c] = await createUsers(page, seed);
  await page.goto(filteredPath("/admin/users", `${seed}*`));
  await expect(page.getByRole("row").nth(1)).toContainText(a.name);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByRole("row").nth(1)).toContainText(b.name);
  const original = readSearch(page);
  await page.getByRole("link", { name: "Create user", exact: true }).click();
  await page.reload();
  await backToList(page);
  await expect(page.getByRole("row").nth(1)).toContainText(b.name);
  expect(readSearch(page)).toEqual(original);
  await page.getByRole("link", { name: "Create user", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Unrelated created user");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(`${uniqueSeed("unrelated-created")}@example.com`);
  await page
    .getByLabel("Temporary password", { exact: true })
    .fill(testPassword);
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await expect(page.getByRole("row").nth(1)).toContainText(b.name);
  expect(readSearch(page)).toEqual(original);
  await page
    .getByRole("row")
    .filter({ hasText: b.name })
    .getByRole("cell")
    .first()
    .click();
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `/admin/users/${a.id}`);
  await expect(page.getByLabel("Next item", { exact: true })).toHaveAttribute(
    "href",
    `/admin/users/${c.id}`,
  );
  await expect(page.locator('[data-slot="page-pagination"]')).toBeVisible();
  await page.getByTestId("admin-user-name").fill("Unsaved draft");
  await page.getByLabel("Next item", { exact: true }).click();
  await expect(page.getByTestId("admin-user-name")).toHaveValue(c.name);
  await expect(page.getByLabel("Next item", { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `/admin/users/${b.id}`);
  await page.reload();
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `/admin/users/${b.id}`);
  await backToList(page);
  await expect(page.getByRole("row").nth(1)).toContainText(c.name);
  expect(readSearch(page)).toMatchObject({
    ...original,
    after: expect.any(String),
  });
  expect(
    JSON.parse(Buffer.from(readSearch(page).after, "base64").toString()).id,
  ).toBe(b.id);
});

test("member navigation and invitation return searches stay isolated by workspace", async ({
  page,
}) => {
  const seed = uniqueSeed("member-navigation");
  await signInAsE2eAdministrator(page);
  const users = await createUsers(page, seed);
  const firstWorkspace = await createWorkspaceByApi(page, `${seed}-first`);
  const secondWorkspace = await createWorkspaceByApi(page, `${seed}-second`);
  const members: Array<string> = [];
  for (const user of users)
    members.push(await addMemberByApi(page, firstWorkspace.id, user.email));
  await addMemberByApi(page, secondWorkspace.id, users[0].email);
  const firstList = `/workspaces/${firstWorkspace.id}/members`;
  const secondList = `/workspaces/${secondWorkspace.id}/members`;
  await page.goto(filteredPath(firstList, `${seed}*`, "CREATED_AT", "DESC"));
  await expect(page.getByRole("row").nth(1)).toContainText(users[2].name);
  await page
    .getByRole("button", { name: "Next page", exact: true })
    .first()
    .click();
  await expect(page.getByRole("row").nth(1)).toContainText(users[1].name);
  const firstSearch = readSearch(page);
  await page.goto(`${firstList}/invite`);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(page.getByRole("row").nth(1)).toContainText(users[1].name);
  expect(readSearch(page)).toEqual(firstSearch);
  await page.goto(`${firstList}/${members[1]}`);
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `${firstList}/${members[2]}`);
  await expect(page.getByLabel("Next item", { exact: true })).toHaveAttribute(
    "href",
    `${firstList}/${members[0]}`,
  );
  await page.locator("#member-name").fill("Unsaved member draft");
  await page.getByLabel("Next item", { exact: true }).click();
  await expect(page.locator("#member-name")).toHaveValue(users[0].name);
  await expect(page.getByLabel("Next item", { exact: true })).toBeDisabled();
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `${firstList}/${members[1]}`);
  await backToList(page);
  await expect(page.getByRole("row").nth(1)).toContainText(users[0].name);
  const anchoredSearch = readSearch(page);
  expect(
    JSON.parse(Buffer.from(anchoredSearch.after, "base64").toString()),
  ).toMatchObject({ id: members[1], value: expect.any(String) });
  await page.goto(filteredPath(secondList, users[0].email));
  await expect(page.getByRole("row").nth(1)).toContainText(users[0].name);
  const secondSearch = readSearch(page);
  await page.goto(`${secondList}/invite`);
  await page
    .getByTestId("workspace-invite-email-input")
    .fill(`${seed}-invited@example.com`);
  await page.getByRole("checkbox", { name: "Member", exact: true }).check();
  await page.getByTestId("workspace-invite-confirm").click();
  await expect(page.getByTestId("workspace-invite-result")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Members", exact: true }),
  ).toBeVisible();
  expect(readSearch(page)).toEqual(secondSearch);
  await page.goto(`${firstList}/invite`);
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(page.getByRole("row").nth(1)).toContainText(users[0].name);
  expect(readSearch(page)).toEqual(anchoredSearch);
});

test("workspace overview and settings use browser history to restore list search without back actions or record pagination", async ({
  page,
}) => {
  const seed = uniqueSeed("workspace-navigation");
  await registerUser(page, {
    name: "Workspace navigator",
    email: `${seed}@example.com`,
  });
  const workspaces = [];
  for (const letter of ["A", "B", "C"])
    workspaces.push(await createWorkspaceByApi(page, `${seed} ${letter}`));
  await createWorkspaceByApi(page, "Unrelated workspace");
  const [, b, c] = workspaces;
  await page.goto(
    filteredPath(
      "/user/workspaces",
      workspaces.map(({ name }) => JSON.stringify(name)).join(" OR "),
      "CREATED_AT",
      "DESC",
    ),
  );
  await expect(page.getByRole("row").nth(1)).toContainText(c.name);
  await page
    .getByRole("button", { name: "Next page", exact: true })
    .first()
    .click();
  await expect(page.getByRole("row").nth(1)).toContainText(b.name);
  const original = readSearch(page);
  await page
    .getByRole("link", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/user\/workspaces\/create$/);
  await page.reload();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("user-sidebar-workspaces-link"),
  ).toHaveAttribute("data-active", "true");
  await expect(
    page.getByRole("heading", { name: "Create Workspace", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveAttribute("placeholder", "My Workspace");
  await expect(
    page
      .getByRole("navigation", { name: "Breadcrumbs" })
      .getByRole("link", { name: "Workspaces", exact: true }),
  ).toBeVisible();
  await page.getByTestId("topbar-menu-trigger").click();
  await page.getByTestId("user-menu-language").click();
  await page
    .getByRole("menuitemradio", { name: "简体中文", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "创建工作空间", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("创建一个新的工作空间，开始管理您的项目。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "名称", exact: true }),
  ).toHaveAttribute("placeholder", "我的工作空间");
  await expect(
    page.getByRole("button", { name: "创建", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "面包屑导航" })
      .getByRole("link", { name: "工作空间", exact: true }),
  ).toBeVisible();
  await page.getByTestId("topbar-menu-trigger").click();
  await page.getByTestId("user-menu-language").click();
  await page
    .getByRole("menuitemradio", { name: "English", exact: true })
    .click();
  await backToList(page);
  await expect(page.getByRole("row").nth(1)).toContainText(b.name);
  expect(readSearch(page)).toEqual(original);
  await page.getByRole("row").nth(1).getByRole("cell").nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${b.id}$`));
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  let neighborQueries = 0;
  page.on("request", (request) => {
    if (request.postData()?.includes("getWorkspaceNeighbors"))
      neighborQueries++;
  });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByTestId("workspace-settings-name-input")).toHaveValue(
    b.name,
  );
  await expect(page.locator('[data-slot="page-pagination"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("workspace-settings-name-input")).toHaveValue(
    b.name,
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumbs" }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${b.id}$`));
  await page.goBack();
  await expect(page.getByRole("row").nth(1)).toContainText(b.name);
  expect(readSearch(page)).toEqual(original);
  expect(neighborQueries).toBe(0);
});
