import { expect, test } from "@playwright/test";

import {
  e2eAdministratorEmail,
  registerUser,
  signInAsE2eAdministrator,
} from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";

test("resets each admin form when navigating between users without reloading", async ({
  page,
}) => {
  const duplicateKeyErrors: Array<string> = [];
  page.on("console", (message) => {
    if (/Encountered two children with the same key/i.test(message.text())) {
      duplicateKeyErrors.push(message.text());
    }
  });
  await signInAsE2eAdministrator(page);
  const users = [];
  for (const name of ["First managed user", "Second managed user"]) {
    const { createUser } = await graphqlRequest<{ createUser: { id: string } }>(
      page.request,
      "mutation($input: CreateUserInput!) { createUser(input: $input) { id } }",
      {
        input: {
          name,
          email: `${uniqueSeed("form-identity")}@example.com`,
          password: "test-password",
        },
      },
    );
    users.push({ ...createUser, name });
  }
  await page.goto(`/admin/users/${users[0].id}`);
  await page.getByTestId("admin-user-name").fill("First user's unsaved draft");
  await page.getByTestId("user-role-ADMIN").check();
  await page.getByTestId("permission-USER__READ").check();

  for (const user of [users[1], users[0]]) {
    await page.evaluate((id) => {
      // TanStack's browser history subscription handles this without a document reload.
      window.history.pushState({}, "", `/admin/users/${id}`);
    }, user.id);
    await expect(
      page.getByRole("heading", { name: user.name, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("admin-user-name")).toHaveCount(1);
    await expect(page.getByTestId("admin-user-name")).toHaveValue(user.name);
    await expect(page.getByTestId("user-role-USER")).toBeChecked();
    await expect(page.getByTestId("user-role-ADMIN")).not.toBeChecked();
    await expect(page.getByTestId("permission-USER__READ")).not.toBeChecked();
    await page.getByTestId("admin-user-name").fill("Another unsaved draft");
  }
  expect(duplicateKeyErrors).toEqual([]);
});

test("preserves independent user drafts when another section is saved", async ({
  browser,
  page,
}) => {
  const context = await browser.newContext();
  try {
    const targetPage = await context.newPage();
    await registerUser(targetPage, {
      email: `${uniqueSeed("admin-drafts")}@example.com`,
      name: "Original profile",
    });
    const { currentUser } = await graphqlRequest<{
      currentUser: { id: string };
    }>(targetPage.request, "query { currentUser { id } }");
    await signInAsE2eAdministrator(page);
    let paginationComplete = false;
    let failProfileSave = true;
    await page.route("**/graphql", async (route) => {
      const operation = route.request().postDataJSON();
      if (
        operation.operationName === "updateManagedUserFromUserRoute" &&
        failProfileSave
      ) {
        failProfileSave = false;
        await route.fulfill({
          json: { errors: [{ message: "Profile save rejected" }] },
        });
        return;
      }
      if (
        operation.operationName === "getUserFromUserRoute" &&
        operation.variables.includeSessions
      ) {
        if (operation.variables.sessionsAfter) paginationComplete = true;
        const response = await route.fetch();
        const body = await response.json();
        if (body.data?.user?.sessions && !paginationComplete) {
          body.data.user.sessions.pageInfo.hasNextPage = true;
        }
        await route.fulfill({ response, json: body });
        return;
      }
      await route.continue();
    });
    await page.goto(`/admin/users/${currentUser.id}`);
    await page.getByTestId("admin-user-name").fill("Unsaved profile");
    await page.getByTestId("permission-USER__READ").check();
    await page.getByTestId("user-role-ADMIN").check();
    await page.getByTestId("admin-user-sessions-more").click();
    await expect(
      page.getByTestId("admin-user-sessions-more"),
    ).not.toBeVisible();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Unsaved profile",
    );
    await expect(page.getByTestId("permission-USER__READ")).toBeChecked();
    await expect(page.getByTestId("user-role-ADMIN")).toBeChecked();
    await page.getByTestId("admin-user-roles-save").click();
    await expect(page.getByTestId("admin-user-roles-save")).toBeEnabled();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Unsaved profile",
    );
    await expect(page.getByTestId("permission-USER__READ")).toBeChecked();
    await page.getByTestId("admin-user-permissions-save").click();
    await expect(page.getByTestId("admin-user-permissions-save")).toBeEnabled();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Unsaved profile",
    );
    await page.getByTestId("admin-user-profile-save").click();
    await expect(page.getByText("Profile save rejected")).toBeVisible();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Unsaved profile",
    );
    await page.getByTestId("admin-user-profile-save").click();
    await expect(
      page.getByRole("heading", { name: "Unsaved profile", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("user-role-ADMIN")).toBeChecked();
    await expect(page.getByTestId("permission-USER__READ")).toBeChecked();
    await expect(page.getByTestId("admin-user-name")).toHaveValue(
      "Unsaved profile",
    );
  } finally {
    await context.close();
  }
});

for (const change of [
  "roles",
  "permissions",
  "current-session",
  "all-sessions",
] as const) {
  test(`refreshes authentication after changing own ${change} from the administrator page`, async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed(`self-${change}`);
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await registerUser(page, {
        email: `${seed}@example.com`,
        name: "Self-editing administrator",
      });
      const { currentUser, currentSession } = await graphqlRequest<{
        currentUser: { id: string };
        currentSession: { id: string };
      }>(page.request, "query { currentUser { id } currentSession { id } }");
      await signInAsE2eAdministrator(adminPage);
      if (change === "permissions") {
        await graphqlRequest(
          adminPage.request,
          "mutation($id: ID!, $input: SetUserPermissionsInput!) { setUserPermissions(id: $id, input: $input) { id } }",
          {
            id: currentUser.id,
            input: {
              permissions: ["USER__READ", "USER__SET_PERMISSIONS"],
            },
          },
        );
      } else {
        await graphqlRequest(
          adminPage.request,
          "mutation($id: ID!, $input: SetUserRolesInput!) { setUserRoles(id: $id, input: $input) { id } }",
          { id: currentUser.id, input: { roles: ["ADMIN"] } },
        );
      }
      await page.goto(`/admin/users/${currentUser.id}`);
      await expect(page.getByTestId("admin-user-page")).toBeVisible();
      await expect(page.getByTestId("admin-user-sessions-revoke")).toHaveText(
        "撤销全部会话",
      );
      const refetches: Array<string> = [];
      const pageErrors: Array<string> = [];
      page.on("request", (request) => {
        const body = request.postData() ?? "";
        if (body.includes("getUserFromUserRoute")) refetches.push(body);
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      if (change === "roles") {
        await page.getByTestId("user-role-USER").check();
        await page.getByTestId("user-role-ADMIN").uncheck();
        await page.getByTestId("admin-user-roles-save").click();
      } else if (change === "permissions") {
        for (const permission of ["USER__READ", "USER__SET_PERMISSIONS"])
          await page.getByTestId(`permission-${permission}`).uncheck();
        await page.getByTestId("admin-user-permissions-save").click();
      } else {
        await page
          .getByTestId(
            change === "current-session"
              ? `admin-user-session-revoke-${currentSession.id}`
              : "admin-user-sessions-revoke",
          )
          .click();
      }
      if (change === "roles" || change === "permissions") {
        await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
        await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
        await page.getByTestId("sidebar-user-menu").click();
        await expect(page.getByTestId("sidebar-admin-link")).toHaveCount(0);
      } else {
        await expect(page).toHaveURL(/\/auth\/login(?:\?.*)?$/);
        await expect(page.getByTestId("auth-submit")).toBeVisible();
      }
      expect(refetches).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally {
      await adminContext.close();
    }
  });
}

test.describe("administrator impersonation", () => {
  test("shows the global banner and restores the administrator session", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("impersonation");
    const targetEmail = `${seed}@example.com`;
    const targetContext = await browser.newContext({
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
    });
    const targetPage = await targetContext.newPage();

    let targetId: string;
    try {
      await registerUser(targetPage, {
        email: targetEmail,
        name: `Impersonation Target ${seed}`,
      });
      const target = await graphqlRequest<{ currentUser: { id: string } }>(
        targetPage.request,
        /* GraphQL */ `
          query ImpersonationTarget {
            currentUser {
              id
            }
          }
        `,
      );
      targetId = target.currentUser.id;
    } finally {
      await targetContext.close();
    }

    await signInAsE2eAdministrator(page);
    await page.goto(`/admin/users/${targetId}`);
    await expect(page.getByTestId("admin-user-page")).toBeVisible();
    await page.getByTestId("admin-impersonate-user").click();

    await expect(page).toHaveURL(/\/user$/);
    await expect(page.getByTestId("user-current-email")).toHaveValue(
      targetEmail,
    );
    await expect(page.getByTestId("impersonation-banner")).toBeVisible();

    await page.goto("/user/security");
    await expect(page.getByTestId("user-security-page")).toBeVisible();
    await expect(page.getByTestId("impersonation-banner")).toBeVisible();

    await page.goto("/user/workspaces");
    await expect(page.getByTestId("user-workspaces-page")).toBeVisible();
    await expect(page.getByTestId("impersonation-banner")).toBeVisible();
    await page.getByTestId("stop-impersonating").click();

    await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
    await expect(page.getByTestId("admin-users-page")).toBeVisible();
    await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);

    const restored = await graphqlRequest<{
      currentUser: { email: string };
      currentSession: { impersonatedById: string | null };
    }>(
      page.request,
      /* GraphQL */ `
        query RestoredAdministrator {
          currentUser {
            email
          }
          currentSession {
            impersonatedById
          }
        }
      `,
    );
    expect(restored).toEqual({
      currentUser: { email: e2eAdministratorEmail },
      currentSession: { impersonatedById: null },
    });
  });
});
