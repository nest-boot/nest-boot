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
  await page.goto("/admin/api-keys");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "System account", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "You", exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Name", { exact: true }).fill(name);
  await getPermissionCheckbox(page, "USER__READ").check();
  let attempts = 0;
  let accountsCreated = 0;
  await page.route("**/graphql", async (route) => {
    const operation = route.request().postDataJSON().operationName;
    if (operation === "createManagedSystemAccount") accountsCreated++;
    if (operation === "createManagedSystemAccountKey" && ++attempts === 1) {
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
  const secretField = page.getByLabel("Key", { exact: true });
  await expect(secretField).toHaveValue(/^sys_[A-Za-z0-9_-]{64}$/);
  const secret = await secretField.inputValue();
  expect(attempts).toBe(2);
  expect(accountsCreated).toBe(1);
  await expect(page.getByLabel("Owned by", { exact: true })).toHaveValue(name);
  const keyId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1);
  const { systemAccounts } = await graphqlRequest<{
    systemAccounts: {
      edges: Array<{
        node: {
          id: string;
          apiKeys: { edges: Array<{ node: { id: string } }> };
        };
      }>;
    };
  }>(
    page.request,
    "query($filter: SystemAccountFilter) { systemAccounts(first: 10, filter: $filter) { edges { node { id apiKeys(first: 10) { edges { node { id } } } } } } }",
    { filter: { name } },
  );
  const accountId = systemAccounts.edges[0].node.id;
  expect(
    systemAccounts.edges[0].node.apiKeys.edges.map(({ node }) => node.id),
  ).toContain(keyId);
  await expect(
    getPermissionCheckbox(page, "WORKSPACE__READ_ANY"),
  ).toBeDisabled();

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
    const read = (credential = secret) =>
      machine.post("/api/graphql", {
        headers: { authorization: `Bearer ${credential}` },
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
    await expect(page).toHaveURL(/\/admin\/api-keys\/?(?:\?.*)?$/);
    expect((await read()).status()).toBe(401);
    const { createSystemApiKey: dependent } = await graphqlRequest<{
      createSystemApiKey: { apiKey: string; entity: { id: string } };
    }>(
      page.request,
      'mutation($id: ID!) { createSystemApiKey(systemAccountId: $id, input: {name: "Retained audit credential", permissions: [USER__READ]}) { apiKey entity { id } } }',
      { id: accountId },
    );
    const activeCredential = await read(dependent.apiKey);
    expect(activeCredential.status()).toBe(200);
    expect((await activeCredential.json()).errors).toBeUndefined();
    await page.goto(`/admin/system-accounts/${accountId}`);
    await clickPageAction(page, "Delete");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/system-accounts\/?(?:\?.*)?$/);
    expect((await read(dependent.apiKey)).status()).toBe(401);
    const remaining = await graphqlRequest<{ systemApiKey: unknown }>(
      page.request,
      "query($id: ID!) { systemApiKey(id: $id) { id enabled systemAccount { id } } }",
      { id: dependent.entity.id },
    );
    expect(remaining.systemApiKey).toEqual({
      id: dependent.entity.id,
      enabled: false,
      systemAccount: null,
    });
    await page.goto(`/admin/api-keys/${dependent.entity.id}`);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Retained audit credential",
    );
    await expect(page.getByLabel("Owned by", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Key", { exact: true })).toBeDisabled();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Archived audit credential");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.reload();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Archived audit credential",
    );
    await clickPageAction(page, "Enable");
    await expect(
      page.getByText("System account not found", { exact: true }),
    ).toBeVisible();
    await page.reload();
    const retained = await graphqlRequest<{
      systemApiKey: { name: string; enabled: boolean; systemAccount: null };
    }>(
      page.request,
      "query($id: ID!) { systemApiKey(id: $id) { name enabled systemAccount { id } } }",
      { id: dependent.entity.id },
    );
    expect(retained.systemApiKey).toEqual({
      name: "Archived audit credential",
      enabled: false,
      systemAccount: null,
    });
    expect((await read(dependent.apiKey)).status()).toBe(401);
    await page
      .getByRole("link", { name: "API Keys", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("Archived audit credential", { exact: true }),
    ).toBeVisible();
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
            ["SystemAccount", "SystemApiKey"].includes(subject),
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
    await page.goto("/admin/api-keys/create");
    await expect(page).toHaveURL(/\/admin\/api-keys\/?(?:\?.*)?$/);
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

test("selects an existing system account and refreshes its key permission ceiling", async ({
  page,
}) => {
  await signInAsE2eAdministrator(page);
  const name = uniqueSeed("existing-system-account");
  await page.goto("/admin/system-accounts/create");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await getPermissionCheckbox(page, "USER__READ").check();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const accountId = new URL(page.url()).pathname
    .split("/")
    .filter(Boolean)
    .at(-1);
  try {
    await page.goto("/admin/api-keys/create");
    await page.getByLabel("Name", { exact: true }).fill("Existing account key");
    await getPermissionCheckbox(page, "WORKSPACE__READ_ANY").check();
    const select = page.getByRole("combobox", {
      name: "System account",
      exact: true,
    });
    await select.fill(name);
    await page.getByRole("option", { name, exact: true }).click();
    await expect(
      getPermissionCheckbox(page, "WORKSPACE__READ_ANY"),
    ).toBeDisabled();
    await expect(
      getPermissionCheckbox(page, "WORKSPACE__READ_ANY"),
    ).not.toBeChecked();
    await getPermissionCheckbox(page, "USER__READ").check();
    let createdAccounts = 0;
    page.on("request", (request) => {
      if (
        request.url().endsWith("/api/graphql") &&
        request
          .postData()
          ?.includes('"operationName":"createManagedSystemAccount"')
      )
        createdAccounts++;
    });
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByLabel("Key", { exact: true })).toHaveValue(
      /^sys_[A-Za-z0-9_-]{64}$/,
    );
    await expect(page.getByLabel("Owned by", { exact: true })).toHaveValue(
      name,
    );
    expect(createdAccounts).toBe(0);
    await page
      .getByRole("link", { name: "API Keys", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/admin\/api-keys\/?(?:\?.*)?$/);
    await expect(
      page.getByText("Existing account key", { exact: true }),
    ).toBeVisible();
  } finally {
    await graphqlRequest(
      page.request,
      "mutation($id: ID!) { deleteSystemAccount(id: $id) { id } }",
      { id: accountId },
    );
  }
});
