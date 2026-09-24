import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";
import { createFirstWorkspace, createWorkspaceByApi } from "./utils/workspace";

test("validates and retries invitations on their own page with recoverable copy failure", async ({
  page,
  context,
}) => {
  const seed = uniqueSeed("invite-page");
  await registerUser(page, {
    email: `${seed}@example.com`,
    name: "Invite page owner",
  });
  const workspaceId = await createFirstWorkspace(page, seed);
  const otherWorkspace = await createWorkspaceByApi(page, `${seed}-other`);
  const path = `/workspaces/${workspaceId}/members/invite`;
  const email = `${seed}-invited@example.com`;
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page.getByTestId("workspace-invite-email-input").fill(email);
  await page.getByRole("checkbox", { name: "Member", exact: true }).check();
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Members", exact: true }),
  ).toBeVisible();
  await page.goto(path);
  await page.reload();
  await expect(page.getByTestId("workspace-invite-email-input")).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("checkbox", { name: "Member", exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  let attempts = 0;
  await page.route("**/api/graphql", async (route) => {
    if (
      !route
        .request()
        .postData()
        ?.includes("createInvitationFromInviteMemberRoute")
    )
      return route.continue();
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        json: { errors: [{ message: "Temporary invitation failure" }] },
      });
    return route.continue();
  });
  await page.getByTestId("workspace-invite-email-input").fill("invalid-email");
  await page.getByTestId("workspace-invite-confirm").click();
  await expect(
    page.getByText("Select at least one role.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("workspace-invite-email-input"),
  ).toHaveAttribute("aria-invalid", "true");
  expect(attempts).toBe(0);
  await page.getByTestId("workspace-invite-email-input").fill(email);
  await page.getByRole("checkbox", { name: "Member", exact: true }).check();
  await page.getByTestId("workspace-invite-email-input").press("Enter");
  await expect(
    page.getByText("Temporary invitation failure", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("workspace-invite-email-input")).toHaveValue(
    email,
  );
  await expect(
    page.getByRole("checkbox", { name: "Member", exact: true }),
  ).toBeChecked();
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("Clipboard unavailable")),
    });
  });
  await page.getByTestId("workspace-invite-confirm").click();
  const result = page.getByTestId("workspace-invite-result");
  await expect(result).toBeVisible();
  await expect(page.getByTestId("workspace-invite-confirm")).toHaveCount(0);
  const link = await result.getByTestId("workspace-invite-link").textContent();
  expect(link).toContain("/invite?invitationId=");
  expect(attempts).toBe(2);
  await expect(
    page.getByText(
      "The invitation was created, but the link could not be copied. You can select and copy it manually.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    Reflect.deleteProperty(navigator.clipboard, "writeText"),
  );
  await page.getByTestId("workspace-invite-copy").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/workspaces/${workspaceId}/members(?:\\?.*)?$`),
  );
  await expect(page.getByTestId(`invitation-${email}`)).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });

  // Another workspace must not inherit the completed invitation or its draft.
  await page.goto(`/workspaces/${otherWorkspace.id}/members/invite`);
  await expect(page.getByTestId("workspace-invite-email-input")).toHaveValue(
    "",
  );
  await expect(page.getByTestId("workspace-invite-link")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Breadcrumbs" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(page.getByTestId(`invitation-${email}`)).toHaveCount(0);
});
