import { expect, test } from "@playwright/test";

import { registerUser } from "./utils/auth";
import { uniqueSeed } from "./utils/unique";
import { createWorkspaceByApi } from "./utils/workspace";

test.use({ timezoneId: "America/Los_Angeles" });

test("formats table dates in the browser time zone and updates them with the UI language", async ({
  page,
}) => {
  const name = uniqueSeed("table-format");
  await registerUser(page, {
    email: `${name}@example.com`,
    name: "Table format owner",
  });
  await createWorkspaceByApi(page, name);

  await page.route("**/api/graphql", async (route) => {
    if (
      route.request().postDataJSON()?.operationName !==
      "getWorkspacesFromUserWorkspacesRoute"
    ) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const json = await response.json();
    for (const { node } of json.data.currentUser.workspaces.edges) {
      // A UTC timestamp whose local calendar date is the preceding day.
      node.createdAt = "2026-01-02T04:00:00.000Z";
      node.updatedAt = "2026-01-02T04:00:00.000Z";
    }
    await route.fulfill({ response, json });
  });

  await page.goto("/user/workspaces");
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
  const createdAt = row.getByRole("cell").nth(1);
  const updatedAt = row.getByRole("cell").nth(2);
  await expect(createdAt).toHaveText("01/01/2026");
  await expect(updatedAt).toHaveText("01/01/2026");

  for (const [language, expected] of [
    ["简体中文", "2026/01/01"],
    ["English", "01/01/2026"],
  ]) {
    await page
      .getByRole("button", {
        name: /^(Account:|Workspace and account:|账号：|工作空间与账号：)/,
      })
      .click();
    await page.getByRole("menuitem", { name: /^(Language|语言)$/ }).click();
    await page
      .getByRole("menuitemradio", { name: language, exact: true })
      .click();
    await expect(createdAt).toHaveText(expected);
    await expect(updatedAt).toHaveText(expected);
  }
});
