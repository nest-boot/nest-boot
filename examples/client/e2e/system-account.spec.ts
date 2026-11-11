import { expect, test } from "@playwright/test";
import { registerUser, signInAsE2eAdministrator } from "./utils/auth";
import { graphqlRequest } from "./utils/graphql";
import { getPermissionCheckbox } from "./utils/permissions";
import { clickPageAction } from "./utils/page-actions";
import { uniqueSeed } from "./utils/unique";

test("manages system identities and credentials under admin, with one-time secrets and immediate revocation", async ({
  page,
  playwright,
}) => {
  test.setTimeout(90_000);
  await signInAsE2eAdministrator(page);
  const name = uniqueSeed("system-account");
  await page.goto("/admin");
  await page
    .getByRole("link", { name: "Manage system accounts", exact: true })
    .click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await getPermissionCheckbox(page, "USER__READ").check();
  let attempts = 0;
  await page.route("**/graphql", async (route) => {
    if (
      route.request().postDataJSON().operationName ===
        "createManagedSystemAccount" &&
      ++attempts === 1
    ) {
      await route.fulfill({
        json: { errors: [{ message: "Temporary creation failure" }] },
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByText("Temporary creation failure", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  const accountId = new URL(page.url()).pathname
    .split("/")
    .filter(Boolean)
    .at(-1);
  expect(accountId).toBeTruthy();
  await page.getByRole("link", { name: "API Keys", exact: true }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    getPermissionCheckbox(page, "WORKSPACE__READ_ANY"),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Key permissions are limited by this account and your grants. An empty selection grants no access.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Deployment");
  await getPermissionCheckbox(page, "USER__READ").check();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const secretField = page.getByLabel("Key", { exact: true });
  await expect(secretField).toHaveValue(/^sys_[A-Za-z0-9_-]{64}$/);
  const secret = await secretField.inputValue();
  const keyPath = new URL(page.url()).pathname;
  expect(page.url()).not.toContain(secret);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain(secret);
  await page.reload();
  await expect(secretField).toBeDisabled();
  await expect(secretField).not.toHaveValue(secret);
  const machine = await playwright.request.newContext({
    baseURL: process.env.SERVER_E2E_URL ?? "http://127.0.0.1:4100",
    extraHTTPHeaders: { authorization: `Bearer ${secret}` },
  });
  try {
    const read = () =>
      machine.post("/api/graphql", {
        data: { query: "{ users(first: 1) { totalCount } }" },
      });
    expect((await read()).status()).toBe(200);
    expect((await (await read()).json()).errors).toBeUndefined();
    await page.getByLabel("Name", { exact: true }).fill("Renamed deployment");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Renamed deployment",
    );
    await getPermissionCheckbox(page, "USER__READ").uncheck();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(
        async () => (await (await read()).json()).errors?.[0]?.extensions.code,
      )
      .toBe("FORBIDDEN");
    await getPermissionCheckbox(page, "USER__READ").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await (await read()).json()).errors)
      .toBeUndefined();
    await clickPageAction(page, "Disable");
    await expect.poll(async () => (await read()).status()).toBe(401);
    await clickPageAction(page, "Enable");
    await expect.poll(async () => (await read()).status()).toBe(200);
    await page.goto(`/admin/system-accounts/${accountId}`);
    await clickPageAction(page, "Disable");
    await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
    expect((await read()).status()).toBe(401);
    await clickPageAction(page, "Enable");
    await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
    expect((await (await read()).json()).errors).toBeUndefined();
    await page.getByLabel("Name", { exact: true }).fill(`${name} renamed`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: `${name} renamed`, exact: true }),
    ).toBeVisible();
    await page.goto(keyPath);
    await clickPageAction(page, "Delete");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/system-accounts/${accountId}/api-keys/?(?:\\?.*)?$`),
    );
    expect((await read()).status()).toBe(401);
    const { createSystemAccountApiKey: dependent } = await graphqlRequest<{
      createSystemAccountApiKey: { entity: { id: string } };
    }>(
      page.request,
      'mutation($id: ID!) { createSystemAccountApiKey(systemAccountId: $id, input: {name: "Cascade"}) { entity { id } } }',
      { id: accountId },
    );
    await page.goto(`/admin/system-accounts/${accountId}`);
    await page.screenshot({
      path: "/tmp/review434-system-account.png",
      fullPage: true,
    });
    await clickPageAction(page, "Delete");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/system-accounts\/?(?:\?.*)?$/);
    expect((await read()).status()).toBe(401);
    const remaining = await graphqlRequest<{ systemAccountApiKey: unknown }>(
      page.request,
      "query($id: ID!) { systemAccountApiKey(id: $id) { id } }",
      { id: dependent.entity.id },
    );
    expect(remaining.systemAccountApiKey).toBeNull();
  } finally {
    await machine.dispose();
  }
});

test("ordinary users cannot enter the system-account administrator routes", async ({
  page,
}) => {
  await registerUser(page, {
    name: "Ordinary",
    email: `${uniqueSeed("system-denied")}@example.com`,
  });
  await page.goto("/admin/system-accounts/create");
  await expect(page).toHaveURL(/\/user(?:\/|$)/);
  await expect(
    page.getByRole("heading", { name: "Create System Account", exact: true }),
  ).toHaveCount(0);
});

test("read-only system-account abilities hide writes and reject direct create routes", async ({
  page,
}) => {
  await signInAsE2eAdministrator(page);
  const { createSystemAccount: account } = await graphqlRequest<{
    createSystemAccount: { id: string };
  }>(
    page.request,
    'mutation { createSystemAccount(input: {name: "Read-only system account"}) { id } }',
  );
  try {
    await page.route("**/graphql", async (route) => {
      if (
        route.request().postDataJSON().operationName !==
        "getCurrentUserFromAuthenticatedRoute"
      )
        return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      body.data.currentAbilityRules = body.data.currentAbilityRules.map(
        (rule: { subjects: Array<string>; actions: Array<string> }) => ({
          ...rule,
          actions: rule.subjects.some((subject) =>
            ["SystemAccount", "SystemAccountApiKey"].includes(subject),
          )
            ? rule.actions.filter((action) => action !== "write")
            : rule.actions,
        }),
      );
      await route.fulfill({ response, json: body });
    });
    await page.goto(`/admin/system-accounts/${account.id}`);
    await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Delete", exact: true }),
    ).toHaveCount(0);
    await page.goto("/admin/system-accounts/create");
    await expect(page).toHaveURL(/\/admin\/system-accounts\/?(?:\?.*)?$/);
    await expect(
      page.getByRole("link", { name: "Create", exact: true }),
    ).toHaveCount(0);
    await page.goto(`/admin/system-accounts/${account.id}/api-keys/create`);
    await expect(page).toHaveURL(
      new RegExp(`/admin/system-accounts/${account.id}/api-keys/?(?:\\?.*)?$`),
    );
    await expect(
      page.getByRole("button", { name: "Create", exact: true }),
    ).toBeDisabled();
  } finally {
    await graphqlRequest(
      page.request,
      "mutation($id: ID!) { deleteSystemAccount(id: $id) { id } }",
      { id: account.id },
    );
  }
});

test("respects permission-field restrictions and sends only edited account fields", async ({
  page,
}) => {
  await signInAsE2eAdministrator(page);
  const { createSystemAccount: account } = await graphqlRequest<{
    createSystemAccount: { id: string };
  }>(
    page.request,
    'mutation { createSystemAccount(input: {name: "Field restricted", permissions: [USER__READ]}) { id } }',
  );
  try {
    await page.route("**/graphql", async (route) => {
      if (
        route.request().postDataJSON().operationName !==
        "getCurrentUserFromAuthenticatedRoute"
      )
        return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      body.data.currentAbilityRules.push({
        subjects: ["SystemAccount"],
        actions: ["write"],
        fields: ["permissions"],
        inverted: true,
      });
      await route.fulfill({ response, json: body });
    });
    await page.goto(`/admin/system-accounts/${account.id}`);
    await expect(getPermissionCheckbox(page, "USER__READ")).toBeDisabled();
    await page.getByLabel("Name", { exact: true }).fill("Updated name only");
    const request = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/graphql") &&
        request.postData()?.includes("updateManagedSystemAccount") === true,
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect((await request).postDataJSON().variables.input).toEqual({
      name: "Updated name only",
    });
    await expect(
      page.getByRole("heading", { name: "Updated name only", exact: true }),
    ).toBeVisible();
  } finally {
    await graphqlRequest(
      page.request,
      "mutation($id: ID!) { deleteSystemAccount(id: $id) { id } }",
      { id: account.id },
    );
  }
});
