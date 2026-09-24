import { expect, test } from "@playwright/test";
import { getPermissionCheckbox } from "./utils/permissions";

import {
  e2eAdministratorEmail,
  registerUser,
  signInAsE2eAdministrator,
} from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";

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
      const { currentUser } = await graphqlRequest<{
        currentUser: { id: string };
      }>(page.request, "query { currentUser { id } }");
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
      await expect(
        page
          .locator('[data-slot="page"]')
          .filter({ has: page.getByLabel("Email", { exact: true }) }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Revoke all sessions", exact: true }),
      ).toHaveText("Revoke all sessions");
      const refetches: Array<string> = [];
      const pageErrors: Array<string> = [];
      page.on("request", (request) => {
        const body = request.postData() ?? "";
        if (body.includes("getUserFromUserRoute")) refetches.push(body);
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      if (change === "roles") {
        await page.getByRole("checkbox", { name: "User", exact: true }).check();
        await page
          .getByRole("checkbox", { name: "Admin", exact: true })
          .uncheck();
        await page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Roles", { exact: true }) })
          .getByRole("button", { name: "Save", exact: true })
          .click();
      } else if (change === "permissions") {
        for (const permission of ["USER__READ", "USER__SET_PERMISSIONS"])
          await getPermissionCheckbox(page, permission).uncheck();
        await page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Permissions", { exact: true }) })
          .getByRole("button", { name: "Save", exact: true })
          .click();
      } else {
        await page
          .getByRole("button", {
            name:
              change === "current-session" ? "Revoke" : "Revoke all sessions",
            exact: true,
          })
          .click();
      }
      if (change === "roles" || change === "permissions") {
        await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
        await expect(
          page.getByRole("heading", { name: "Workspaces", exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
          })
          .click();
        await expect(
          page.getByRole("menuitem", { name: "Administration", exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(page).toHaveURL(/\/auth\/login(?:\?.*)?$/);
        await expect(
          page.getByRole("button", {
            name: /^(Loading )?(Sign in|Create account)$/,
          }),
        ).toBeVisible();
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
      locale: "en-US",
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
    await expect(
      page
        .locator('[data-slot="page"]')
        .filter({ has: page.getByLabel("Email", { exact: true }) }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Impersonate user", exact: true })
      .click();

    await expect(page).toHaveURL(/\/user$/);
    await expect(
      page.getByRole("main").getByText(targetEmail, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("You are impersonating another user.", { exact: true }),
    ).toBeVisible();

    await page.goto("/user/security");
    await expect(
      page.getByRole("heading", { name: "Security", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("You are impersonating another user.", { exact: true }),
    ).toBeVisible();

    await page.goto("/user/workspaces");
    await expect(
      page.getByRole("heading", { name: "Workspaces", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("You are impersonating another user.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Return to administrator", exact: true })
      .click();

    await expect(page).toHaveURL(/\/admin\/users(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Users", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("You are impersonating another user.", { exact: true }),
    ).toHaveCount(0);

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
