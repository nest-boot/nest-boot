import { expect, test } from "@playwright/test";
import { registerUser, signInAsE2eAdministrator } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { addMemberByApi, createWorkspaceByApi } from "./utils/workspace";
import type { Page } from "@playwright/test";

function sidebarOverview(page: Page) {
  return page
    .locator('[data-slot="sidebar"]')
    .getByRole("link", { name: "Overview", exact: true });
}

function countCard(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    })
    .locator('[data-slot="card-content"]');
}

test("user overview retries failed summaries and keeps profile and security separate with exact navigation", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("user-overview")}@example.com`,
    name: "Overview user",
  });
  await createWorkspaceByApi(page, "Overview workspace");
  let attempts = 0;
  await page.route("**/api/graphql", async (route) => {
    if (route.request().postDataJSON().operationName !== "getUserOverview")
      return route.continue();
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        json: {
          data: null,
          errors: [{ message: "Temporary overview failure" }],
        },
      });
    return route.continue();
  });
  await page.goto("/user");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("alert")).toContainText(
    "Could not load overview.",
  );
  await expect(countCard(page, "Workspaces")).toHaveText("—");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(countCard(page, "Workspaces")).toHaveText("1");
  await expect(countCard(page, "Active sessions")).toHaveText("1");
  await expect(countCard(page, "API Keys")).toHaveText("0");
  await expect(page.getByRole("alert")).toHaveCount(0);
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
  const overviewResponse = page.waitForResponse(
    (response) =>
      response.request().postData()?.includes("query getAdminOverview") ===
      true,
  );
  await page.getByTestId("topbar-menu-trigger").click();
  await page
    .getByRole("menuitem", { name: "Administration", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
  const {
    data: { users },
  } = await (await overviewResponse).json();
  await expect(countCard(page, "Users")).toHaveText(
    users.totalCount.toLocaleString("en-US"),
  );
  await page.getByRole("link", { name: "Manage users", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
  await expect(sidebarOverview(page)).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("workspace overviews isolate counts when switching and respect read permissions", async ({
  page,
  browser,
}) => {
  const seed = uniqueSeed("workspace-overview");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Overview owner",
  });
  const first = await createWorkspaceByApi(page, "First overview workspace");
  const second = await createWorkspaceByApi(page, "Second overview workspace");
  const context = await browser.newContext({ locale: "en-US" });
  const memberPage = await context.newPage();
  try {
    const email = `${seed}-member@example.com`;
    await registerUser(memberPage, { email, name: "Overview member" });
    const memberId = await addMemberByApi(page, first.id, email);
    await graphqlRequest(
      page.request,
      `mutation ($id: ID!, $input: SetMemberPermissionsInput!) {
      setMemberPermissions(id: $id, input: $input) { id }
    }`,
      { id: memberId, input: { permissions: [] } },
      { "x-workspace-id": first.id },
    );
    const queries: Array<{ workspaceId: string; header: string | undefined }> =
      [];
    page.on("request", (request) => {
      if (!request.postData()?.includes("query getWorkspaceOverview")) return;
      queries.push({
        workspaceId: request.postDataJSON().variables.workspaceId,
        header: request.headers()["x-workspace-id"],
      });
    });
    await page.goto("/user/workspaces");
    await page.getByRole("link", { name: first.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${first.id}$`));
    await expect(countCard(page, "Members")).toHaveText("2");
    await expect(sidebarOverview(page)).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(sidebarOverview(page)).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator('[data-slot="page-pagination"]')).toHaveCount(0);
    await page.getByTestId("topbar-menu-trigger").click();
    await page
      .getByRole("menuitemradio", { name: second.name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${second.id}$`));
    await expect(countCard(page, "Members")).toHaveText("1");
    expect(queries.map(({ workspaceId }) => workspaceId)).toEqual(
      expect.arrayContaining([first.id, second.id]),
    );
    expect(
      queries.every(({ workspaceId, header }) => workspaceId === header),
    ).toBe(true);

    const memberSummary = memberPage.waitForResponse(
      (response) =>
        response
          .request()
          .postData()
          ?.includes("query getWorkspaceOverview") === true,
    );
    await memberPage.goto(`/workspaces/${first.id}`);
    const response = await memberSummary;
    expect(response.request().postDataJSON().variables).toMatchObject({
      includeMembers: true,
      includeApiKeys: false,
    });
    expect((await response.json()).errors).toBeUndefined();
    await expect(
      memberPage.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();
    await expect(
      memberPage.getByRole("link", { name: "View API keys", exact: true }),
    ).toHaveCount(0);
    await expect(
      memberPage.getByRole("link", { name: "Manage members", exact: true }),
    ).toBeVisible();
    await expect(countCard(memberPage, "Members")).toHaveText("2");
    await expect(memberPage.getByRole("alert")).toHaveCount(0);
    await expect(
      memberPage.getByRole("link", { name: "Settings", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
