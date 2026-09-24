import { expect, test } from "@playwright/test";

import { registerUser, testPassword } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { waitForEmailUrl } from "./utils/mailpit";
import { uniqueSeed } from "./utils/unique";
import { createFirstWorkspace } from "./utils/workspace";
import type { Page } from "@playwright/test";

test.describe("user pages", () => {
  test("opens the profile from the user row and persists language and theme preferences", async ({
    page,
  }) => {
    await registerUser(page, {
      email: `${uniqueSeed("user-preferences")}@example.com`,
      name: "Preferences User",
    });
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    const profileLink = page.getByRole("menuitem", { name: /^Open profile:/ });
    await expect(profileLink).toContainText("Preferences User");
    await expect(profileLink).toHaveAttribute("href", "/user/profile");
    await expect(
      page.getByRole("menuitem", { name: "Workspaces", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: "API Keys", exact: true }),
    ).toHaveCount(0);
    await profileLink.click();
    await expect(page).toHaveURL(/\/user\/profile$/);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^(Language|语言)$/ }).click();
    await page
      .getByRole("menuitemradio", { name: "简体中文", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "个人资料", exact: true }),
    ).toBeVisible();

    const nameInput = page.getByLabel(/^(Name|名称)$/);
    await nameInput.fill("Unsaved profile name");
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^(Language|语言)$/ }).click();
    await page
      .getByRole("menuitemradio", { name: "English", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toHaveText("Security");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(nameInput).toHaveValue("Unsaved profile name");

    const selectTheme = async (name: string) => {
      await page
        .getByRole("button", {
          name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
        })
        .click();
      await page.getByRole("menuitem", { name: "Theme", exact: true }).click();
      await page.getByRole("menuitemradio", { name, exact: true }).click();
    };
    await selectTheme("Dark");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: "Theme", exact: true }).click();
    await expect(
      page.getByRole("menuitemradio", { name: "Dark", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("menuitemradio", { name: "Light", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);

    await page.emulateMedia({ colorScheme: "dark" });
    await selectTheme("System");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await page.reload();
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^(Language|语言)$/ }).click();
    await expect(
      page.getByRole("menuitemradio", { name: "English", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("menuitemradio", { name: "简体中文", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "个人资料", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
  });

  test("navigates top-level pages with the mobile drawer, account menu, and browser history", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await registerUser(page, {
      email: `${uniqueSeed("mobile-navigation")}@example.com`,
      name: "Mobile navigation",
    });
    await page.goto("/user/profile");

    const viewport = page.getByRole("main");
    await page
      .getByRole("button", { name: "Send verification email", exact: true })
      .scrollIntoViewIfNeeded();
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    const navigation = page.getByRole("button", { name: "Toggle navigation" });
    await navigation.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("link", { name: "Security", exact: true }).click();
    await expect(page).toHaveURL(/\/user\/security$/);
    await expect(navigation).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollTop))
      .toBe(0);

    await page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Delete account", { exact: true }) })
      .scrollIntoViewIfNeeded();
    const securityScrollTop = await viewport.evaluate(
      (element) => element.scrollTop,
    );
    expect(securityScrollTop).toBeGreaterThan(200);
    await expect(
      page.getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      }),
    ).toBeInViewport();
    await expect(navigation).toBeInViewport();
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^Open profile:/ }).click();
    await expect(page).toHaveURL(/\/user\/profile$/);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollTop))
      .toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/user\/security$/);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollTop))
      .toBe(securityScrollTop);
    await page.goForward();
    await expect(page).toHaveURL(/\/user\/profile$/);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollTop))
      .toBe(0);

    await navigation.click();
    await page.getByRole("link", { name: "Security", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumbs" }),
    ).toHaveCount(0);
    await navigation.click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Overview", exact: true })
      .click();
    await expect(page).toHaveURL(/\/user$/);
    await expect(
      page.getByRole("heading", { name: "Overview", exact: true }),
    ).toBeVisible();

    await navigation.click();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toBeVisible();
    await expect(navigation).toBeHidden();
  });

  test("loads subsequent pages of linked accounts", async ({ page }) => {
    await registerUser(page, {
      email: `${uniqueSeed("account-pages")}@example.com`,
      name: "Account pages",
    });
    const cursors: Array<string | null> = [];
    const { currentUser } = await graphqlRequest<{
      currentUser: { id: string };
    }>(page.request, `query { currentUser { id } }`);
    await page.route("**/api/graphql", async (route) => {
      const request = route.request().postDataJSON();
      if (request.operationName !== "getAccountsFromUserSecurity") {
        await route.continue();
        return;
      }
      const after = request.variables?.after ?? null;
      cursors.push(after);
      const start = after ? 20 : 0;
      const edges = Array.from({ length: after ? 1 : 20 }, (_, offset) => {
        const id = String(start + offset);
        return {
          __typename: "AccountEdge",
          node: {
            __typename: "Account",
            id,
            accountId: id,
            issuer: "test",
            providerId: `test-${id}`,
            scopes: [],
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        };
      });
      await route.fulfill({
        json: {
          data: {
            currentUser: {
              __typename: "User",
              id: currentUser.id,
              accounts: {
                __typename: "AccountConnection",
                totalCount: 21,
                edges,
                pageInfo: {
                  __typename: "PageInfo",
                  hasNextPage: !after,
                  endCursor: after ? "last" : "next",
                },
              },
            },
          },
        },
      });
    });
    try {
      await page.goto("/user/security");
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Linked accounts", { exact: true }) })
          .getByText("test-0", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Linked accounts", { exact: true }) })
          .getByText("test-20", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Load more", exact: true })
        .click();
      await expect.poll(() => cursors).toContain("next");
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Linked accounts", { exact: true }) })
          .getByText("test-20", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Linked accounts", { exact: true }) })
          .getByText("test-0", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Load more", exact: true }),
      ).toHaveCount(0);
      expect(cursors).toContain("next");
    } finally {
      await page.unrouteAll({ behavior: "wait" });
    }
  });
  test("manages the profile and navigates personal resources", async ({
    page,
  }) => {
    const seed = uniqueSeed("user-pages");
    const email = `${seed}@example.com`;
    const newEmail = `${seed}-changed@example.com`;
    const workspaceName = `个人工作空间 ${seed}`;
    const updatedName = `Updated User ${seed}`;

    await registerUser(page, {
      email,
      name: `User ${seed}`,
    });
    await createFirstWorkspace(page, workspaceName);

    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^Open profile:/ }).click();

    await expect(page).toHaveURL(/\/user\/profile$/);
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();

    const nameInput = page.getByLabel("Name", { exact: true });
    await nameInput.fill(updatedName);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(nameInput).toHaveValue(updatedName);

    await page.reload();
    await expect(nameInput).toHaveValue(updatedName);

    await page.getByLabel("New email", { exact: true }).fill(newEmail);
    await page
      .getByRole("button", { name: "Send verification email", exact: true })
      .click();
    await expect(
      page.getByText("Confirmation email sent to your current address"),
    ).toBeVisible();

    const confirmationUrl = await waitForEmailUrl(
      page.request,
      email,
      "Confirm your email change",
    );
    await page.goto(confirmationUrl);
    await expect(page).toHaveURL(/\/user\/profile\?emailChangeCallback=true/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Email change confirmed" }),
    ).toBeVisible();

    const verificationUrl = await waitForEmailUrl(
      page.request,
      newEmail,
      "Verify your email address",
    );
    await page.goto(verificationUrl);
    await expect(page).toHaveURL(/\/user\/profile\?emailChangeCallback=true/);
    await expect(
      page.getByRole("alert").filter({ hasText: "Email changed" }),
    ).toBeVisible();
    await expect(page.getByLabel("Current email", { exact: true })).toHaveValue(
      newEmail,
    );

    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: "Workspaces", exact: true })
      .click();
    await expect(page).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "Workspaces", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();

    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: "API Keys", exact: true })
      .click();
    await expect(page).toHaveURL(/\/user\/api-keys(?:\?.*)?$/);
    await expect(
      page.getByRole("heading", { name: "API Keys", exact: true }),
    ).toBeVisible();
  });

  test("lists active sessions and signs out other devices", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("user-sessions");
    const email = `${seed}@example.com`;

    await registerUser(page, {
      email,
      name: `Session User ${seed}`,
    });

    const otherContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const otherPage = await otherContext.newPage();

    try {
      await otherPage.goto("/auth/login");
      await otherPage.getByLabel("Email", { exact: true }).fill(email);
      await otherPage
        .getByLabel("Password", { exact: true })
        .fill(testPassword);
      await otherPage
        .getByRole("button", { name: /^(Loading )?(Sign in|Create account)$/ })
        .click();
      await expect(otherPage).toHaveURL(/\/user\/workspaces(?:\?.*)?$/);

      await page.goto("/user/security");
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Active sessions", { exact: true }) })
          .getByRole("listitem"),
      ).toHaveCount(2);
      await expect(
        page.getByText("Current session", { exact: true }),
      ).toHaveCount(1);

      await page
        .getByRole("button", { name: "Sign out other sessions", exact: true })
        .click();
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ has: page.getByText("Active sessions", { exact: true }) })
          .getByRole("listitem"),
      ).toHaveCount(1);
      await expect(page.getByText("Other sessions signed out")).toBeVisible();

      await otherPage.goto("/user/profile");
      await expect(otherPage).toHaveURL(/\/auth\/login/);
    } finally {
      await otherContext.close();
    }
  });

  test("accepts and rejects pending workspace invitations", async ({
    browser,
    page,
  }) => {
    const seed = uniqueSeed("user-invitations");
    const inviteeEmail = `${seed}-invitee@example.com`;
    const ownerEmail = `${seed}-owner@example.com`;
    const acceptedWorkspaceName = `接受邀请工作空间 ${seed}`;
    const rejectedWorkspaceName = `拒绝邀请工作空间 ${seed}`;

    await registerUser(page, {
      email: inviteeEmail,
      name: `Invitee ${seed}`,
    });

    const ownerContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "Asia/Shanghai",
    });
    const ownerPage = await ownerContext.newPage();

    try {
      await registerUser(ownerPage, {
        email: ownerEmail,
        name: `Owner ${seed}`,
      });

      const acceptedWorkspace = await createWorkspaceByApi(
        ownerPage,
        acceptedWorkspaceName,
      );
      const rejectedWorkspace = await createWorkspaceByApi(
        ownerPage,
        rejectedWorkspaceName,
      );
      await createInvitationByApi(
        ownerPage,
        acceptedWorkspace.id,
        inviteeEmail,
      );
      await createInvitationByApi(
        ownerPage,
        rejectedWorkspace.id,
        inviteeEmail,
      );

      await page.reload();
      await expect(
        page.locator('[data-slot="card"]').filter({
          has: page.getByText("Pending invitations", { exact: true }),
        }),
      ).toBeVisible();
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({
            has: page.getByText("Pending invitations", { exact: true }),
          })
          .getByRole("cell", { name: acceptedWorkspaceName, exact: true }),
      ).toHaveText(acceptedWorkspaceName);
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({
            has: page.getByText("Pending invitations", { exact: true }),
          })
          .getByRole("cell", { name: rejectedWorkspaceName, exact: true }),
      ).toHaveText(rejectedWorkspaceName);

      // Prime the switcher before membership changes, without reloading afterward.
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

      await page
        .getByRole("row")
        .filter({
          has: page.getByRole("cell", {
            name: acceptedWorkspaceName,
            exact: true,
          }),
        })
        .getByRole("button", { name: "Accept", exact: true })
        .click();
      await expect(
        page.getByText("Invitation accepted", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({
            has: page.getByText("Pending invitations", { exact: true }),
          })
          .getByRole("cell", { name: acceptedWorkspaceName, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: acceptedWorkspaceName, exact: true }),
      ).toHaveText(acceptedWorkspaceName);

      await page
        .getByRole("button", {
          name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
        })
        .click();
      await expect(
        page.getByRole("menuitemradio", {
          name: acceptedWorkspaceName,
          exact: true,
        }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);

      await page
        .getByRole("row")
        .filter({
          has: page.getByRole("cell", {
            name: rejectedWorkspaceName,
            exact: true,
          }),
        })
        .getByRole("button", { name: "Reject", exact: true })
        .click();
      await expect(
        page.getByText("Invitation rejected", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({
            has: page.getByText("Pending invitations", { exact: true }),
          })
          .getByRole("cell", { name: rejectedWorkspaceName, exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: rejectedWorkspaceName, exact: true }),
      ).toHaveCount(0);
    } finally {
      await ownerContext.close();
    }
  });
});

async function createWorkspaceByApi(page: Page, name: string) {
  return (
    await graphqlRequest<{
      createWorkspace: { id: string };
    }>(
      page.request,
      /* GraphQL */ `
        mutation CreateWorkspaceForUserInvitationTest(
          $input: CreateWorkspaceInput!
        ) {
          createWorkspace(input: $input) {
            id
          }
        }
      `,
      { input: { name } },
    )
  ).createWorkspace;
}

async function createInvitationByApi(
  page: Page,
  workspaceId: string,
  email: string,
) {
  return (
    await graphqlRequest<{
      createInvitation: { id: string };
    }>(
      page.request,
      /* GraphQL */ `
        mutation CreateInvitationForUserInvitationTest(
          $input: CreateInvitationInput!
        ) {
          createInvitation(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          email,
          roles: ["MEMBER"],
        },
      },
      { "x-workspace-id": workspaceId },
    )
  ).createInvitation;
}
