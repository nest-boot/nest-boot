import { expect, test } from "@playwright/test";
import { signInAsE2eAdministrator } from "./utils/auth";
import { createWorkspaceByApi } from "./utils/workspace";
import { uniqueSeed } from "./utils/unique";

test("user, admin and workspace layouts keep account actions in a collapsible full-height sidebar", async ({
  page,
}, testInfo) => {
  await signInAsE2eAdministrator(page);
  const workspace = await createWorkspaceByApi(
    page,
    uniqueSeed("sidebar-layout"),
  );
  const workspaceMenuRequests: Array<string> = [];
  page.on("request", (request) => {
    if (request.postData()?.includes("getWorkspacesFromWorkspaceSwitcher")) {
      workspaceMenuRequests.push(request.url());
    }
  });
  for (const path of [
    "/user/profile",
    "/admin",
    `/workspaces/${workspace.id}/settings`,
  ]) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("font-family", /sans-serif/);
    await expect(page.getByRole("banner")).toHaveCount(0);
    const sidebar = page.locator('[data-slot="sidebar"]');
    const header = sidebar.locator('[data-slot="layout-sidebar-header"]');
    const logo = header.locator('[data-slot="layout-sidebar-logo"]');
    const title = header.getByRole("link", { name: "Nest Boot", exact: true });
    const trigger = header.locator('[data-slot="layout-sidebar-trigger"]');
    await expect(logo).toBeVisible();
    await expect(title).toBeVisible();
    const footer = sidebar.locator('[data-slot="sidebar-footer"]');
    const account = footer.getByRole("button", {
      name: /^(Account:|Workspace and account:)/,
    });
    await expect(account).toBeInViewport();
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().height))
      .toBe(800);
    const expandedWidth = await sidebar.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    await page
      .getByRole("button", { name: "Collapse navigation", exact: true })
      .click();
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeLessThan(expandedWidth);
    await page.getByRole("main").hover();
    await expect(logo).toBeVisible();
    await expect(title).toBeHidden();
    await expect(trigger).toHaveCSS("opacity", "0");
    if (path === "/user/profile")
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("collapsed-sidebar.png"),
      });
    await header.hover();
    await expect(logo).toBeHidden();
    await expect(trigger).toHaveCSS("opacity", "1");
    await account.click();
    await expect(
      page.getByRole("menuitem", { name: /^Open personal overview:/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Manage workspaces", exact: true }),
    ).toBeVisible();
    if (path.startsWith("/workspaces/")) {
      await expect(
        page.getByText("Recent workspaces", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitemradio", { name: workspace.name, exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByText("Recent workspaces", { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole("menuitemradio")).toHaveCount(0);
      expect(workspaceMenuRequests).toHaveLength(0);
    }
    await page.keyboard.press("Escape");
    await page.getByRole("main").hover();
    await page
      .getByRole("link", { name: "Skip to content", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(
      header.getByRole("button", { name: "Expand navigation", exact: true }),
    ).toBeFocused();
    await expect(trigger).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBe(expandedWidth);
    if (path === "/user/profile")
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("desktop-profile.png"),
      });

    await page.setViewportSize({ width: 390, height: 700 });
    const navigation = page.getByRole("button", {
      name: "Toggle navigation",
      exact: true,
    });
    await expect(navigation).toBeInViewport();
    await navigation.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Nest Boot", exact: true }),
    ).toBeVisible();
    await expect(
      drawer.locator('[data-slot="layout-sidebar-trigger"]'),
    ).toHaveCount(0);
    await drawer
      .getByRole("button", { name: /^(Account:|Workspace and account:)/ })
      .click();
    await expect(
      page.getByRole("menuitem", { name: /^Open personal overview:/ }),
    ).toBeVisible();
    if (path === "/user/profile")
      await page.screenshot({
        animations: "disabled",
        path: testInfo.outputPath("mobile-account.png"),
      });
    await page
      .getByRole("menuitem", { name: /^Open personal overview:/ })
      .click();
    await expect(page).toHaveURL(/\/user$/);
    await expect(drawer).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
});
