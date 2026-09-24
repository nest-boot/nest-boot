import { expect, test } from "@playwright/test";

import { registerUser, signInAsE2eAdministrator } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

for (const scope of ["user", "workspace"] as const) {
  test(`refreshes ${scope} ability providers and route context after a profile change`, async ({
    page,
  }) => {
    const seed = uniqueSeed(`refresh-${scope}`);
    await registerUser(page, {
      email: `${seed}@example.com`,
      name: "Initial profile",
    });
    const workspace = await createWorkspaceByApi(page, seed);
    let identityReads = 0;
    let updated = false;
    let refreshedRoute = false;
    await page.route("**/api/graphql", async (route) => {
      const query = route.request().postDataJSON().query as string;
      const response = await route.fetch();
      const body = await response.json();
      if (
        query.includes(
          scope === "user"
            ? "mutation updateUserFromUserRoute"
            : "mutation updateWorkspaceFromSettingsRoute",
        ) &&
        !body.errors
      )
        updated = true;
      const field = "currentAbilityRules";
      if (body.data?.[field]) {
        identityReads++;
        // Model a server extension whose effective rules change with the profile.
        body.data[field].push({
          actions: [scope === "user" ? "read" : "delete"],
          subjects: [scope === "user" ? "User" : "Workspace"],
          fields: null,
          conditions: null,
          reason: null,
          inverted: updated,
        });
        if (
          updated &&
          query.includes(
            scope === "user"
              ? "getCurrentUserFromAuthenticatedRoute"
              : "getCurrentWorkspaceFromWorkspaceLayout",
          )
        )
          refreshedRoute = true;
      }
      await route.fulfill({ response, json: body });
    });
    await page.goto(
      scope === "user"
        ? "/user/profile"
        : `/workspaces/${workspace.id}/settings`,
    );
    if (scope === "user") {
      await page
        .getByRole("button", {
          name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
        })
        .click();
      await expect(
        page.getByRole("menuitem", { name: "Administration", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } else
      await expect(
        page.getByRole("button", { name: "Delete Workspace", exact: true }),
      ).toBeVisible();
    expect(identityReads).toBe(scope === "user" ? 1 : 2);
    identityReads = 0;
    await page.getByLabel("Name", { exact: true }).fill("Updated profile");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => refreshedRoute).toBe(true);
    expect(identityReads).toBe(scope === "user" ? 1 : 2);
    if (scope === "user") {
      await page
        .getByRole("button", {
          name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
        })
        .click();
      await expect(
        page.getByRole("menuitem", { name: "Administration", exact: true }),
      ).toHaveCount(0);
    } else
      await expect(
        page.getByRole("button", { name: "Delete Workspace", exact: true }),
      ).toHaveCount(0);
  });
}

test("leaves stale impersonation UI after the server revokes a failed restore", async ({
  browser,
  page,
}) => {
  const seed = uniqueSeed("revoked-impersonation");
  const targetContext = await browser.newContext();
  const targetPage = await targetContext.newPage();
  let targetId: string;
  try {
    await registerUser(targetPage, {
      email: `${seed}@example.com`,
      name: "Impersonation target",
    });
    const { currentUser } = await graphqlRequest<{
      currentUser: { id: string };
    }>(targetPage.request, "query { currentUser { id } }");
    targetId = currentUser.id;
  } finally {
    await targetContext.close();
  }
  await signInAsE2eAdministrator(page);
  await page.goto(`/admin/users/${targetId}`);
  await page
    .getByRole("button", { name: "Impersonate user", exact: true })
    .click();
  await expect(
    page.getByText("You are impersonating another user.", { exact: true }),
  ).toBeVisible();
  const errors: Array<string> = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/graphql", async (route) => {
    if (
      !route
        .request()
        .postData()
        ?.includes("mutation stopImpersonatingFromAuthenticatedRoute")
    )
      return route.continue();
    await graphqlRequest(page.request, "mutation { signOut }");
    await route.fulfill({
      json: {
        data: null,
        errors: [
          {
            message: "The administrator identity was revoked",
            extensions: { code: "FORBIDDEN" },
          },
        ],
      },
    });
  });
  await page
    .getByRole("button", { name: "Return to administrator", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/login(?:\?.*)?$/);
  await expect(
    page.getByText("You are impersonating another user.", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
