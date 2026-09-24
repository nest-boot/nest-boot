import { expect, test } from "@playwright/test";
import { registerUser } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";

test("refreshes the workspace menu after changes outside its Apollo cache", async ({
  page,
}) => {
  const seed = uniqueSeed("workspace-menu-refresh");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Workspace menu owner",
  });
  const menuResponse = page.waitForResponse(
    (response) =>
      response
        .request()
        .postData()
        ?.includes("getWorkspacesFromWorkspaceSwitcher") === true,
  );
  await page
    .getByRole("button", {
      name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
    })
    .click();
  await menuResponse;
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  // An API request models another tab changing membership, without writing to Apollo.
  const workspace = await createWorkspaceByApi(page, `New workspace ${seed}`);
  await page
    .getByRole("button", {
      name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
    })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: workspace.name, exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await graphqlRequest(
    page.request,
    "mutation ($id: ID!) { deleteWorkspace(id: $id) { id } }",
    { id: workspace.id },
    { "x-workspace-id": workspace.id },
  );
  const refreshedMenu = page.waitForResponse(
    (response) =>
      response
        .request()
        .postData()
        ?.includes("getWorkspacesFromWorkspaceSwitcher") === true,
  );
  await page
    .getByRole("button", {
      name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
    })
    .click();
  await refreshedMenu;
  await expect(
    page.getByText("Loading workspaces…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
});

test("retries menu requests and keeps pagination within the current opening", async ({
  page,
}) => {
  await registerUser(page, {
    email: `${uniqueSeed("workspace-menu-retry")}@example.com`,
    name: "Workspace menu retries",
  });
  const workspaces = Array.from({ length: 11 }, (_, index) => ({
    id: String(index + 1),
    name: `Workspace ${index + 1}`,
  }));
  let initialRequests = 0;
  let moreRequests = 0;
  await page.route("**/api/graphql", async (route) => {
    const request = route.request().postDataJSON();
    if (request.operationName !== "getWorkspacesFromWorkspaceSwitcher")
      return route.continue();
    if (!request.variables.after) {
      initialRequests++;
      return route.fulfill({
        json:
          initialRequests === 1
            ? { errors: [{ message: "Temporary menu failure" }] }
            : menuData(workspaces.slice(0, 10), true, workspaces.length),
      });
    }
    moreRequests++;
    return route.fulfill({
      json:
        moreRequests === 1
          ? { errors: [{ message: "Temporary page failure" }] }
          : menuData(workspaces.slice(9), false, workspaces.length),
    });
  });
  const pageErrors: Array<string> = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page
    .getByRole("button", {
      name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Retry loading workspaces", exact: true })
    .click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(10);
  await page.getByRole("menuitem", { name: "Load more", exact: true }).click();
  await expect(
    page.getByText("Unable to load workspaces", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("menuitemradio")).toHaveCount(10);
  await page.getByRole("menuitem", { name: "Load more", exact: true }).click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(11);
  await expect(
    page.getByRole("menuitemradio", { name: "Workspace 10", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("menuitem", { name: "Load more", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
    })
    .click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(10);
  await expect(
    page.getByRole("menuitem", { name: "Load more", exact: true }),
  ).toBeVisible();
  expect(initialRequests).toBe(3);
  expect(moreRequests).toBe(2);
  expect(pageErrors).toEqual([]);
});

test("ignores a late page from a closed workspace menu", async ({ page }) => {
  await registerUser(page, {
    email: `${uniqueSeed("workspace-menu-late-page")}@example.com`,
    name: "Workspace menu race",
  });
  let opening = 0;
  let releasePage!: () => void;
  let pageRequested!: () => void;
  const pendingPage = new Promise<void>((resolve) => {
    releasePage = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    pageRequested = resolve;
  });
  await page.route("**/api/graphql", async (route) => {
    const request = route.request().postDataJSON();
    if (request.operationName !== "getWorkspacesFromWorkspaceSwitcher")
      return route.continue();
    if (!request.variables.after) {
      opening++;
      return route.fulfill({
        json:
          opening === 1
            ? menuData([{ id: "1", name: "Old workspace" }], true)
            : menuData([{ id: "3", name: "Current workspace" }], false),
      });
    }
    pageRequested();
    await pendingPage;
    await route.fulfill({
      json: menuData([{ id: "2", name: "Old additional workspace" }], false),
    });
  });
  const pageErrors: Array<string> = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await expect(
      page.getByRole("menuitemradio", { name: "Old workspace", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("menuitem", { name: "Load more", exact: true })
      .click();
    await requestStarted;
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await expect(
      page.getByRole("menuitemradio", {
        name: "Current workspace",
        exact: true,
      }),
    ).toBeVisible();
    const lateResponse = page.waitForResponse(
      (response) =>
        response
          .request()
          .postData()
          ?.includes("getWorkspacesFromWorkspaceSwitcher") === true &&
        Boolean(response.request().postDataJSON().variables.after),
    );
    releasePage();
    await (await lateResponse).finished();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await expect(page.getByRole("menuitemradio")).toHaveCount(1);
    await expect(
      page.getByRole("menuitemradio", {
        name: "Current workspace",
        exact: true,
      }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    releasePage();
  }
});

function menuData(
  workspaces: Array<{ id: string; name: string }>,
  hasNextPage: boolean,
  totalCount = workspaces.length,
) {
  return {
    data: {
      currentUser: {
        __typename: "User",
        workspaces: {
          __typename: "WorkspaceConnection",
          edges: workspaces.map((node) => ({
            __typename: "WorkspaceEdge",
            node: { __typename: "Workspace", ...node },
          })),
          pageInfo: {
            __typename: "PageInfo",
            startCursor: workspaces[0]?.id ?? null,
            endCursor: workspaces.at(-1)?.id ?? null,
            hasNextPage,
            hasPreviousPage: false,
          },
          totalCount,
        },
      },
    },
  };
}
