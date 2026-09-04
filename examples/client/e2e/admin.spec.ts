import { expect, test } from "@playwright/test";

import {
  e2eAdministratorEmail,
  registerUser,
  signInAsE2eAdministrator,
} from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { uniqueSeed } from "./utils/unique";

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
      currentAuthSession: { impersonatedById: string | null };
    }>(
      page.request,
      /* GraphQL */ `
        query RestoredAdministrator {
          currentUser {
            email
          }
          currentAuthSession {
            impersonatedById
          }
        }
      `,
    );
    expect(restored).toEqual({
      currentUser: { email: e2eAdministratorEmail },
      currentAuthSession: { impersonatedById: null },
    });
  });
});
