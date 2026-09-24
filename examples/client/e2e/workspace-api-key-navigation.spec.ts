import { expect, test } from "@playwright/test";
import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";
import type { Page } from "@playwright/test";

function listLocation(url: URL) {
  return {
    pathname: url.pathname,
    search: Object.fromEntries(url.searchParams),
  };
}

async function prepareWorkspace(
  page: Page,
  name: string,
  query: string,
  size: number,
) {
  const workspace = await createWorkspaceByApi(page, name);
  const keys: Array<{ id: string; name: string }> = [];
  for (let index = 0; index < 5; index++) {
    const data = await graphqlRequest<{
      createWorkspaceApiKey: { entity: { id: string; name: string } };
    }>(
      page.request,
      `mutation ($name: String!, $prefix: String!) { createWorkspaceApiKey(input: { name: $name, prefix: $prefix, permissions: [] }) { entity { id name } } }`,
      { name: `${query} ${index + 1}`, prefix: query.toLowerCase() },
      { "x-workspace-id": workspace.id },
    );
    keys.push(data.createWorkspaceApiKey.entity);
  }
  const path = `/workspaces/${workspace.id}/api-keys`;
  const searchQuery = keys.map(({ name }) => JSON.stringify(name)).join(" OR ");
  const params = new URLSearchParams({
    query: searchQuery,
    first: String(size),
    filter: JSON.stringify({ prefix: { $eq: query.toLowerCase() } }),
    orderBy: JSON.stringify({ field: "ID", direction: "ASC" }),
  });
  return { ...workspace, keys, path, searchQuery, url: `${path}?${params}` };
}

test("isolates two workspaces' list search, creation returns and detail navigation in the same browser session", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("workspace-navigation")}@example.com`,
    name: "Workspace navigation",
  });
  const one = await prepareWorkspace(
    page,
    "Navigation workspace one",
    "Alpha",
    2,
  );
  const two = await prepareWorkspace(
    page,
    "Navigation workspace two",
    "Beta",
    3,
  );
  const listUrls: Array<string> = [];
  for (const workspace of [one, two]) {
    await page.goto(workspace.url);
    await expect(
      page.getByRole("link", { name: workspace.keys[0].name, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    const current = workspace === one ? workspace.keys[2] : workspace.keys[3];
    await expect(page.getByRole("row").nth(1)).toContainText(current.name);
    listUrls.push(page.url());
    await page.getByRole("link", { name: current.name, exact: true }).click();
    await expect(page.getByTestId("api-key-rename-input")).toHaveValue(
      current.name,
    );
    await expect(page.getByLabel("Next item", { exact: true })).toHaveAttribute(
      "href",
      `${workspace.path}/${workspace === one ? workspace.keys[3].id : workspace.keys[4].id}`,
    );
  }
  // Entering the first row preserves each workspace's page; create remains read-only.
  const saved = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(sessionStorage).filter(
        ([key]) =>
          key.startsWith("resource-navigation:") &&
          key.endsWith(',"api-keys"]'),
      ),
    ),
  );
  expect(Object.keys(saved)).toHaveLength(2);
  for (const [index, workspace] of [one, two].entries()) {
    await page.goto(`${workspace.path}/create`);
    await page.reload();
    await expect
      .poll(async () => {
        const href = await page
          .getByTestId("api-key-back")
          .getAttribute("href");
        return href ? listLocation(new URL(href, page.url())) : null;
      })
      .toEqual(listLocation(new URL(listUrls[index])));
    await page.getByTestId("api-key-back").click();
    await expect(page).toHaveURL((url) => url.pathname === workspace.path);
    expect(listLocation(new URL(page.url()))).toEqual(
      listLocation(new URL(listUrls[index])),
    );
  }
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(sessionStorage).filter(
          ([key]) =>
            key.startsWith("resource-navigation:") &&
            key.endsWith(',"api-keys"]'),
        ),
      ),
    ),
  ).toEqual(saved);
  await page.goto(`${one.path}/${one.keys[3].id}`);
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `${one.path}/${one.keys[2].id}`);
  await expect(page.getByLabel("Next item", { exact: true })).toHaveAttribute(
    "href",
    `${one.path}/${one.keys[4].id}`,
  );
  await page.getByLabel("Next item", { exact: true }).click();
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `${one.path}/${one.keys[3].id}`);
  await expect(page.getByLabel("Next item", { exact: true })).toBeDisabled();
  await expect
    .poll(async () =>
      page.evaluate((workspaceId) => {
        const entry = Object.entries(sessionStorage).find(
          ([key]) =>
            key.startsWith("resource-navigation:") &&
            key.endsWith(',"api-keys"]') &&
            key.includes(workspaceId),
        );
        if (!entry) return null;
        const search = JSON.parse(entry[1]);
        return search.after ? JSON.parse(atob(search.after)).id : null;
      }, one.id),
    )
    .toBe(one.keys[3].id);
  // Advancing one workspace must leave the other's saved state untouched.
  const otherKey = Object.keys(saved).find((key) => key.includes(two.id))!;
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), otherKey),
  ).toBe(saved[otherKey]);
  await page.getByLabel("Previous item", { exact: true }).click();
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `${one.path}/${one.keys[2].id}`);
  // Workspace detail has one breadcrumb: it must retain only this workspace's conditions.
  await page.locator('[data-slot="breadcrumb-action"]').click();
  await expect(page.getByRole("row").nth(1)).toContainText(one.keys[3].name);
  const returnSearch = new URL(page.url()).searchParams;
  expect(returnSearch.get("first")).toBe("2");
  expect(returnSearch.get("query")).toBe(one.searchQuery);
  expect(JSON.parse(returnSearch.get("filter")!)).toEqual({
    prefix: { $eq: "alpha" },
  });
  await page.goto(`${two.path}/${two.keys[3].id}`);
  await expect(
    page.getByLabel("Previous item", { exact: true }),
  ).toHaveAttribute("href", `${two.path}/${two.keys[2].id}`);
  await expect(page.getByLabel("Next item", { exact: true })).toHaveAttribute(
    "href",
    `${two.path}/${two.keys[4].id}`,
  );
  await page.getByTestId("api-key-back").click();
  await expect(page).toHaveURL((url) => url.pathname === two.path);
  expect(listLocation(new URL(page.url()))).toEqual(
    listLocation(new URL(listUrls[1])),
  );
  await expect(page.getByRole("row").nth(1)).toContainText(two.keys[3].name);
});
